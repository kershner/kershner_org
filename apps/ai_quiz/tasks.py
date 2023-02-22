from celery.utils.log import get_task_logger
from django.utils import timezone
from django.conf import settings
from kershner.celery import app
from utility import util
import openai
import json

log = get_task_logger(__name__)
QUESTION_SEPARATOR = '^='
DELIMIT = '||'


@app.task(name='process-quiz')
def process_quiz(quiz_id):
    from apps.ai_quiz.models import AiQuiz, AiQuizQuestion, AiQuizAnswer
    log.info('\n============ Running process_quiz() as Celery task....')

    new_quiz = AiQuiz.objects.filter(id=quiz_id).first()
    api_prompt = f'''
    Generate {new_quiz.num_questions} questions about {new_quiz.subject}
    Questions should be in format [question {DELIMIT} answer {DELIMIT} source]
    Delimit questions with {QUESTION_SEPARATOR}
    '''
    log.info(f"api_prompt: {api_prompt}")
    openai.api_key = settings.OPENAI_API_KEY

    try:
        openai_response = openai.Completion.create(
          model=new_quiz.model_engine,
          prompt=api_prompt,
          temperature=new_quiz.temperature,
          max_tokens=1400,
          # top_p=1,
          frequency_penalty=0.0,
          presence_penalty=0.6
        )

        log.info(f"openai_response: {openai_response}")

        questions_text = openai_response['choices'][0]['text'].strip()
        questions_list = questions_text.split(QUESTION_SEPARATOR)

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

                AiQuizAnswer.objects.create(
                    question=new_question,
                    text=answer_text,
                    source=answer_source
                )
            except IndexError as e:
                continue

        new_quiz.settings_hash = new_quiz.openai_settings_hash
        new_quiz.openai_response = json.dumps(openai_response)
        new_quiz.processed = timezone.now()
    except Exception as e:
        new_quiz.error = str(e)

    new_quiz.save()

    log.info("process_quiz() completed!")
