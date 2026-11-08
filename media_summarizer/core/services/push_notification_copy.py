"""What a push notification says, in the interface language of the device it goes to.

A queue message reaches every device of an account, and one account can have two
phones set to two languages, so the producers no longer write any text: they
describe the notification (its kind and the parameters it needs) and the consumer,
``workers/push_notification_worker.py``, renders it here once per locale of the
account's registered tokens.

**The locale is the app's interface language**, sent by the app with its token
(``POST /api/push-token``), and not the account's ``reading_language``: that one
picks the language of the generated content, and someone reading English
summaries in a French interface is a supported combination (owner decision of
2026-11-08, TASK-619). A token registered without a locale renders in English.

**The locales are the app's eleven** (``SUPPORTED_LOCALES`` in
``packages/core/src/i18n/locales.ts``), with the same English fallback.

**Two invariants this module carries for every language:**

- The media-ready title is word for word the name the app gives its Android
  channel (``notifications.mediaReadyChannel`` in ``packages/core/src/i18n/``), so
  the category the user mutes in the system settings says what the notifications
  in it say (task-407).
- A body names the media's *category* and nothing more: no title, no creator and
  no source platform, because Expo's staff can read payloads while debugging
  (task-368, task-407). Each category is a whole sentence per language rather than
  a word slotted into a template, because the sentence agrees with the noun's
  gender in French, Italian, Portuguese, German and Hindi.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Literal, Optional, Tuple

SUPPORTED_LOCALES: Tuple[str, ...] = (
    "en", "fr", "es", "de", "it", "pt", "nl", "ja", "zh", "ar", "hi",
)
FALLBACK_LOCALE = "en"

#: The categories a media-ready body can name. ``source`` is the generic one, for
#: a media whose type is unknown (see ``push_notification_dispatch``).
MediaCategory = Literal[
    "podcast_episode", "article", "video", "image", "audio", "note", "document",
    "source",
]
MEDIA_CATEGORIES: Tuple[str, ...] = (
    "podcast_episode", "article", "video", "image", "audio", "note", "document",
    "source",
)

PluralCategory = Literal["zero", "one", "two", "few", "many", "other"]


def normalize_locale(value: Optional[str]) -> str:
    """A supported locale for whatever the app sent, ``en`` when it is not one.

    Takes the language part of a tag (``pt-PT`` → ``pt``) so a client that ever
    sends a region does not silently fall back to English.
    """
    language = (value or "").strip().lower().replace("_", "-").split("-", 1)[0]
    return language if language in SUPPORTED_LOCALES else FALLBACK_LOCALE


def plural_category(locale: str, count: int) -> PluralCategory:
    """CLDR cardinal category for a non-negative integer, as ``Intl.PluralRules``.

    Written out for the eleven locales because the backend has no CLDR library,
    and integers are all a count of saved items can be. The ``many`` that CLDR
    gives French, Spanish, Italian and Portuguese applies only to exact multiples
    of a million, which no Digest reaches, so it is left to ``other``.
    """
    n = abs(count)
    if locale in ("ja", "zh"):
        return "other"
    if locale in ("fr", "pt", "hi"):
        return "one" if n in (0, 1) else "other"
    if locale == "ar":
        if n == 0:
            return "zero"
        if n == 1:
            return "one"
        if n == 2:
            return "two"
        if 3 <= n % 100 <= 10:
            return "few"
        if 11 <= n % 100 <= 99:
            return "many"
        return "other"
    return "one" if n == 1 else "other"


@dataclass(frozen=True)
class RenderedNotification:
    title: str
    body: str


# --- Media ready ------------------------------------------------------------------

_MEDIA_READY_TITLE: Dict[str, str] = {
    # Must stay equal to `notifications.mediaReadyChannel` in each catalogue.
    "en": "Ready to deepen",
    "fr": "Prêt à approfondir",
    "es": "Listo para profundizar",
    "de": "Bereit zum Vertiefen",
    "it": "Pronto da approfondire",
    "pt": "Pronto para aprofundar",
    "nl": "Klaar om te verdiepen",
    "ja": "深掘りの準備完了",
    "zh": "可以深入了解了",
    "ar": "جاهز للتعمّق",
    "hi": "गहराई से समझने के लिए तैयार",
}

_MEDIA_READY_BODY: Dict[str, Dict[str, str]] = {
    "en": {
        "podcast_episode": "Your podcast episode has been processed.",
        "article": "Your article has been processed.",
        "video": "Your video has been processed.",
        "image": "Your image has been processed.",
        "audio": "Your audio has been processed.",
        "note": "Your note has been processed.",
        "document": "Your document has been processed.",
        "source": "Your source has been processed.",
    },
    "fr": {
        "podcast_episode": "Votre épisode de podcast a été traité.",
        "article": "Votre article a été traité.",
        "video": "Votre vidéo a été traitée.",
        "image": "Votre image a été traitée.",
        "audio": "Votre audio a été traité.",
        "note": "Votre note a été traitée.",
        "document": "Votre document a été traité.",
        "source": "Votre source a été traitée.",
    },
    "es": {
        # The reflexive passive needs no agreement with the noun's gender.
        "podcast_episode": "Tu episodio de podcast se ha procesado.",
        "article": "Tu artículo se ha procesado.",
        "video": "Tu vídeo se ha procesado.",
        "image": "Tu imagen se ha procesado.",
        "audio": "Tu audio se ha procesado.",
        "note": "Tu nota se ha procesado.",
        "document": "Tu documento se ha procesado.",
        "source": "Tu fuente se ha procesado.",
    },
    "de": {
        "podcast_episode": "Deine Podcastfolge wurde verarbeitet.",
        "article": "Dein Artikel wurde verarbeitet.",
        "video": "Dein Video wurde verarbeitet.",
        "image": "Dein Bild wurde verarbeitet.",
        "audio": "Dein Audio wurde verarbeitet.",
        "note": "Deine Notiz wurde verarbeitet.",
        "document": "Dein Dokument wurde verarbeitet.",
        "source": "Deine Quelle wurde verarbeitet.",
    },
    "it": {
        "podcast_episode": "Il tuo episodio di podcast è stato elaborato.",
        "article": "Il tuo articolo è stato elaborato.",
        "video": "Il tuo video è stato elaborato.",
        "image": "La tua immagine è stata elaborata.",
        "audio": "Il tuo audio è stato elaborato.",
        "note": "La tua nota è stata elaborata.",
        "document": "Il tuo documento è stato elaborato.",
        "source": "La tua fonte è stata elaborata.",
    },
    "pt": {
        # European Portuguese, like the app's catalogue.
        "podcast_episode": "O seu episódio de podcast foi processado.",
        "article": "O seu artigo foi processado.",
        "video": "O seu vídeo foi processado.",
        "image": "A sua imagem foi processada.",
        "audio": "O seu áudio foi processado.",
        "note": "A sua nota foi processada.",
        "document": "O seu documento foi processado.",
        "source": "A sua fonte foi processada.",
    },
    "nl": {
        "podcast_episode": "Je podcastaflevering is verwerkt.",
        "article": "Je artikel is verwerkt.",
        "video": "Je video is verwerkt.",
        "image": "Je afbeelding is verwerkt.",
        "audio": "Je audio is verwerkt.",
        "note": "Je notitie is verwerkt.",
        "document": "Je document is verwerkt.",
        "source": "Je bron is verwerkt.",
    },
    "ja": {
        "podcast_episode": "ポッドキャストのエピソードの処理が完了しました。",
        "article": "記事の処理が完了しました。",
        "video": "動画の処理が完了しました。",
        "image": "画像の処理が完了しました。",
        "audio": "音声の処理が完了しました。",
        "note": "メモの処理が完了しました。",
        "document": "ドキュメントの処理が完了しました。",
        "source": "ソースの処理が完了しました。",
    },
    "zh": {
        "podcast_episode": "你的播客单集已处理完成。",
        "article": "你的文章已处理完成。",
        "video": "你的视频已处理完成。",
        "image": "你的图片已处理完成。",
        "audio": "你的音频已处理完成。",
        "note": "你的笔记已处理完成。",
        "document": "你的文档已处理完成。",
        "source": "你的来源已处理完成。",
    },
    "ar": {
        "podcast_episode": "تمت معالجة حلقة البودكاست الخاصة بك.",
        "article": "تمت معالجة مقالك.",
        "video": "تمت معالجة الفيديو الخاص بك.",
        "image": "تمت معالجة صورتك.",
        "audio": "تمت معالجة الملف الصوتي الخاص بك.",
        "note": "تمت معالجة ملاحظتك.",
        "document": "تمت معالجة مستندك.",
        "source": "تمت معالجة مصدرك.",
    },
    "hi": {
        "podcast_episode": "आपका पॉडकास्ट एपिसोड प्रोसेस हो गया है।",
        "article": "आपका लेख प्रोसेस हो गया है।",
        "video": "आपका वीडियो प्रोसेस हो गया है।",
        "image": "आपकी इमेज प्रोसेस हो गई है।",
        "audio": "आपका ऑडियो प्रोसेस हो गया है।",
        "note": "आपका नोट प्रोसेस हो गया है।",
        "document": "आपका दस्तावेज़ प्रोसेस हो गया है।",
        "source": "आपका स्रोत प्रोसेस हो गया है।",
    },
}


def render_media_ready(locale: str, media_category: str) -> RenderedNotification:
    """The ready-to-deepen notification for one media; an unknown category is ``source``."""
    bodies = _MEDIA_READY_BODY[locale]
    return RenderedNotification(
        title=_MEDIA_READY_TITLE[locale],
        body=bodies.get(media_category, bodies["source"]),
    )


# --- Digest -----------------------------------------------------------------------

DigestPeriod = Literal["daily", "weekly"]

_DIGEST_TITLE: Dict[str, Dict[str, str]] = {
    # The product word is the app's own name for the tab (`tabs.digest`).
    "en": {"daily": "Your daily digest is ready", "weekly": "Your weekly digest is ready"},
    "fr": {"daily": "Votre digest quotidien est prêt", "weekly": "Votre digest hebdomadaire est prêt"},
    "es": {"daily": "Tu digest diario está listo", "weekly": "Tu digest semanal está listo"},
    "de": {"daily": "Dein täglicher Digest ist fertig", "weekly": "Dein wöchentlicher Digest ist fertig"},
    "it": {"daily": "Il tuo digest giornaliero è pronto", "weekly": "Il tuo digest settimanale è pronto"},
    "pt": {"daily": "O seu digest diário está pronto", "weekly": "O seu digest semanal está pronto"},
    "nl": {"daily": "Je dagelijkse digest staat klaar", "weekly": "Je wekelijkse digest staat klaar"},
    "ja": {"daily": "毎日のダイジェストの準備ができました", "weekly": "毎週のダイジェストの準備ができました"},
    "zh": {"daily": "你的每日精选已就绪", "weekly": "你的每周精选已就绪"},
    "ar": {"daily": "الدايجست اليومي جاهز", "weekly": "الدايجست الأسبوعي جاهز"},
    "hi": {"daily": "आपका दैनिक डाइजेस्ट तैयार है", "weekly": "आपका साप्ताहिक डाइजेस्ट तैयार है"},
}

#: locale → period → plural category → body with a ``{count}`` placeholder. Every
#: category ``plural_category`` can return for that locale is present; ``other`` is
#: the floor a lookup falls back to.
_DIGEST_BODY: Dict[str, Dict[str, Dict[str, str]]] = {
    "en": {
        "daily": {"one": "You saved {count} item today.", "other": "You saved {count} items today."},
        "weekly": {"one": "You saved {count} item last week.", "other": "You saved {count} items last week."},
    },
    "fr": {
        "daily": {
            "one": "Vous avez enregistré {count} élément aujourd'hui.",
            "other": "Vous avez enregistré {count} éléments aujourd'hui.",
        },
        "weekly": {
            "one": "Vous avez enregistré {count} élément la semaine dernière.",
            "other": "Vous avez enregistré {count} éléments la semaine dernière.",
        },
    },
    "es": {
        "daily": {"one": "Hoy has guardado {count} elemento.", "other": "Hoy has guardado {count} elementos."},
        "weekly": {
            "one": "La semana pasada guardaste {count} elemento.",
            "other": "La semana pasada guardaste {count} elementos.",
        },
    },
    "de": {
        "daily": {
            "one": "Du hast heute {count} Element gespeichert.",
            "other": "Du hast heute {count} Elemente gespeichert.",
        },
        "weekly": {
            "one": "Du hast letzte Woche {count} Element gespeichert.",
            "other": "Du hast letzte Woche {count} Elemente gespeichert.",
        },
    },
    "it": {
        "daily": {"one": "Oggi hai salvato {count} elemento.", "other": "Oggi hai salvato {count} elementi."},
        "weekly": {
            "one": "La settimana scorsa hai salvato {count} elemento.",
            "other": "La settimana scorsa hai salvato {count} elementi.",
        },
    },
    "pt": {
        "daily": {"one": "Hoje guardou {count} item.", "other": "Hoje guardou {count} itens."},
        "weekly": {
            "one": "Na semana passada guardou {count} item.",
            "other": "Na semana passada guardou {count} itens.",
        },
    },
    "nl": {
        "daily": {
            "one": "Je hebt vandaag {count} item opgeslagen.",
            "other": "Je hebt vandaag {count} items opgeslagen.",
        },
        "weekly": {
            "one": "Je hebt vorige week {count} item opgeslagen.",
            "other": "Je hebt vorige week {count} items opgeslagen.",
        },
    },
    "ja": {
        "daily": {"other": "今日は{count}件保存しました。"},
        "weekly": {"other": "先週は{count}件保存しました。"},
    },
    "zh": {
        "daily": {"other": "你今天保存了 {count} 项内容。"},
        "weekly": {"other": "你上周保存了 {count} 项内容。"},
    },
    "ar": {
        "daily": {
            "zero": "لم تحفظ أي عنصر اليوم.",
            "one": "حفظت عنصرًا واحدًا اليوم.",
            "two": "حفظت عنصرين اليوم.",
            "few": "حفظت {count} عناصر اليوم.",
            "many": "حفظت {count} عنصرًا اليوم.",
            "other": "حفظت {count} عنصر اليوم.",
        },
        "weekly": {
            "zero": "لم تحفظ أي عنصر الأسبوع الماضي.",
            "one": "حفظت عنصرًا واحدًا الأسبوع الماضي.",
            "two": "حفظت عنصرين الأسبوع الماضي.",
            "few": "حفظت {count} عناصر الأسبوع الماضي.",
            "many": "حفظت {count} عنصرًا الأسبوع الماضي.",
            "other": "حفظت {count} عنصر الأسبوع الماضي.",
        },
    },
    "hi": {
        "daily": {"one": "आज आपने {count} आइटम सेव किया।", "other": "आज आपने {count} आइटम सेव किए।"},
        "weekly": {
            "one": "पिछले हफ़्ते आपने {count} आइटम सेव किया।",
            "other": "पिछले हफ़्ते आपने {count} आइटम सेव किए।",
        },
    },
}


def render_digest(locale: str, period: str, item_count: int) -> RenderedNotification:
    """The Digest notification for one period. Anything but ``weekly`` is daily."""
    key = "weekly" if period == "weekly" else "daily"
    forms = _DIGEST_BODY[locale][key]
    template = forms.get(plural_category(locale, item_count), forms["other"])
    return RenderedNotification(
        title=_DIGEST_TITLE[locale][key],
        body=template.format(count=item_count),
    )
