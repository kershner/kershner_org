from celery.utils.log import get_task_logger
from django.utils import timezone
from django.conf import settings
from kershner.celery import app
import openai
import json

log = get_task_logger(__name__)
QUESTION_SEPARATOR = '\n'
DELIMIT = '||'


@app.task(name='process-quiz')
def process_quiz(quiz_id):
    from apps.ai_quiz.models import AiQuiz, AiQuizQuestion, AiQuizAnswer
    log.info('\n============ Running process_quiz() as Celery task....')

    new_quiz = AiQuiz.objects.filter(id=quiz_id).first()

    system_prompt = f'''
    You are a quiz generator that returns a strict list of formatted questions.
    Each question must follow this exact format:  
    question{DELIMIT}answer{DELIMIT}name of source  

    - Do not include a question unless it has a complete answer and a valid source.  
    - Do not add placeholders like "answer needed" or "source needed".  
    - Only output the questions. No explanations, no extra text.  

    Example output:  
    What is the capital of France?{DELIMIT}Paris{DELIMIT}National Geographic  
    Who wrote Hamlet?{DELIMIT}William Shakespeare{DELIMIT}Oxford Literature Guide  
    '''

    api_prompt = f'''
    Generate {new_quiz.num_questions} quiz questions about {new_quiz.subject}.  
    Each question must follow this format: question{DELIMIT}answer{DELIMIT}name of source  

    - Do NOT include a question if the answer or source is missing.  
    - Ensure all answers are factual and sources are real.  
    - Only return the quiz questions in the required format.  

    Begin:
    '''

    log.info(f"system_prompt: {system_prompt}")
    log.info(f"api_prompt: {api_prompt}")

    openai.api_key = settings.OPENAI_API_KEY

    moderation_response = None
    try:
        moderation_response = openai.Moderation.create(input=new_quiz.subject)
        new_quiz.moderation_response = json.dumps(moderation_response)
    except Exception as e:
        new_quiz.error = str(e)

    if moderation_response:
        if not moderation_response['results'][0]['flagged']:
            try:
                openai_response = openai.ChatCompletion.create(
                    model=new_quiz.model_engine,
                    temperature=new_quiz.temperature,
                    max_tokens=1000,
                    # top_p=1,
                    frequency_penalty=0.0,
                    presence_penalty=0.6,
                    messages=[
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': api_prompt}
                    ]
                )

                log.info(f"openai_response: {openai_response}")

                questions_text = openai_response['choices'][0]['message']['content'].strip()
                questions_list = questions_text.split(QUESTION_SEPARATOR)

                questions_created = []
                for question in questions_list:
                    try:
                        question = question.strip()
                        question_data = question.split(DELIMIT)
                        question_text = question_data[0].strip()
                        answer_text = question_data[1].strip()
                        answer_source = question_data[2].strip()

                        new_question = AiQuizQuestion.objects.create(
                            quiz=new_quiz,
                            text=question_text
                        )
                        questions_created.append(new_question)

                        AiQuizAnswer.objects.create(
                            question=new_question,
                            text=answer_text,
                            source=answer_source
                        )
                    except IndexError as e:
                        continue

                new_quiz.settings_hash = new_quiz.openai_settings_hash
                new_quiz.openai_response = json.dumps(openai_response)
                new_quiz.cost = new_quiz.get_cost_info()['total_cost']
                new_quiz.processed = timezone.now()
                if not questions_created:
                    new_quiz.error = "No questions generated"
            except Exception as e:
                new_quiz.error = str(e)
        else:
            new_quiz.error = "Moderation flagged"

    new_quiz.save()

    log.info("process_quiz() completed!")
