from django.db import models


class GameSession(models.Model):
    date = models.DateField(unique=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'game session'
        verbose_name_plural = 'game sessions'

    def __str__(self):
        return self.date.isoformat()


class Roll20Message(models.Model):
    TYPE_TEXT = 'text'
    TYPE_CARD = 'card'
    TYPE_ROLL = 'roll'
    TYPE_ATTACK = 'attack'
    TYPE_DAMAGE = 'damage'
    TYPE_CHECK = 'check'
    TYPE_SAVE = 'save'

    TYPE_CHOICES = (
        (TYPE_TEXT, 'Text'),
        (TYPE_CARD, 'Card'),
        (TYPE_ROLL, 'Roll'),
        (TYPE_ATTACK, 'Attack'),
        (TYPE_DAMAGE, 'Damage'),
        (TYPE_CHECK, 'Check'),
        (TYPE_SAVE, 'Save'),
    )

    import_hash = models.CharField(max_length=64, unique=True)
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name='messages')
    session_character_stats = models.ForeignKey(
        'SessionCharacterStats',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='messages',
    )

    timestamp = models.DateTimeField()
    sender = models.CharField(max_length=100, blank=True)
    character = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)

    title = models.CharField(max_length=200, blank=True)
    subtitle = models.CharField(max_length=200, blank=True)
    dice = models.CharField(max_length=200, blank=True)
    roll = models.IntegerField(null=True, blank=True)
    total = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['timestamp', 'id']
        indexes = [
            models.Index(fields=['session', 'character']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['type']),
        ]
        verbose_name = 'Roll20 message'
        verbose_name_plural = 'Roll20 messages'

    def __str__(self):
        return '{} | {} | {}'.format(self.timestamp, self.character, self.title or self.type)


class SessionCharacterStats(models.Model):
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name='character_stats')
    character = models.CharField(max_length=100)

    entries = models.PositiveIntegerField(default=0)
    text_messages = models.PositiveIntegerField(default=0)
    cards = models.PositiveIntegerField(default=0)
    rolls = models.PositiveIntegerField(default=0)

    d20_rolls = models.PositiveIntegerField(default=0)
    d20_total = models.IntegerField(default=0)
    nat20s = models.PositiveIntegerField(default=0)
    nat1s = models.PositiveIntegerField(default=0)

    attacks = models.PositiveIntegerField(default=0)
    checks = models.PositiveIntegerField(default=0)
    saves = models.PositiveIntegerField(default=0)

    damage_rolls = models.PositiveIntegerField(default=0)
    damage_total = models.IntegerField(default=0)

    class Meta:
        ordering = ['-session__date', 'character']
        unique_together = ('session', 'character')
        verbose_name = 'session character stats'
        verbose_name_plural = 'session character stats'

    @property
    def avg_d20(self):
        if not self.d20_rolls:
            return None
        return round(self.d20_total / self.d20_rolls, 2)

    def __str__(self):
        return '{} | {}'.format(self.session, self.character)
