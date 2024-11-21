from rest_framework import serializers
from .models import AiQuiz, AiQuizQuestion, AiQuizAnswer


class AiQuizAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiQuizAnswer
        fields = '__all__'


class AiQuizQuestionSerializer(serializers.ModelSerializer):
    answers = AiQuizAnswerSerializer(many=True, source='aiquizanswer_set')

    class Meta:
        model = AiQuizQuestion
        fields = '__all__'


class AiQuizSerializer(serializers.ModelSerializer):
    questions = AiQuizQuestionSerializer(many=True, source='aiquizquestion_set')

    class Meta:
        model = AiQuiz
        fields = '__all__'
