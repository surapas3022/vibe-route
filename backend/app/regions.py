REGION_ALIASES = {
    "north": "ภาคเหนือ",
    "northern": "ภาคเหนือ",
    "เหนือ": "ภาคเหนือ",
    "ภาคเหนือ": "ภาคเหนือ",
    "northeast": "ภาคตะวันออกเฉียงเหนือ",
    "อีสาน": "ภาคตะวันออกเฉียงเหนือ",
    "ภาคตะวันออกเฉียงเหนือ": "ภาคตะวันออกเฉียงเหนือ",
    "central": "ภาคกลาง",
    "ภาคกลาง": "ภาคกลาง",
    "east": "ภาคตะวันออก",
    "ภาคตะวันออก": "ภาคตะวันออก",
    "south": "ภาคใต้",
    "southern": "ภาคใต้",
    "ภาคใต้": "ภาคใต้",
    "west": "ภาคตะวันตก",
    "ภาคตะวันตก": "ภาคตะวันตก",
}


def normalize_region(raw: str | None, *, default: str = "ภาคเหนือ") -> str:
    if raw is None:
        return default
    text = " ".join(str(raw).split())
    if not text:
        return default
    if text in REGION_ALIASES:
        return REGION_ALIASES[text]
    folded = text.casefold()
    if folded in REGION_ALIASES:
        return REGION_ALIASES[folded]
    letters = "".join(ch for ch in folded if ch.isascii() and ch.isalpha())
    if letters in REGION_ALIASES:
        return REGION_ALIASES[letters]
    return text
