from typing import Optional

RANK_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
RANK_BASE = len(RANK_ALPHABET)
RANK_WIDTH = 10
RANK_INT_MAX = (RANK_BASE ** RANK_WIDTH) - 1


def _rank_int_to_text(rank_int: int) -> str:
    if rank_int < 0 or rank_int > RANK_INT_MAX:
        raise ValueError("rank int out of range")
    value = rank_int
    char_list = ["0"] * RANK_WIDTH
    for idx in range(RANK_WIDTH - 1, -1, -1):
        value, rem = divmod(value, RANK_BASE)
        char_list[idx] = RANK_ALPHABET[rem]
    return "".join(char_list)


def _rank_text_to_int(rank_text: str) -> int:
    normalized = str(rank_text or "").strip().lower()
    if len(normalized) != RANK_WIDTH:
        raise ValueError(f"rank must be exactly {RANK_WIDTH} chars")
    value = 0
    for char in normalized:
        digit = RANK_ALPHABET.find(char)
        if digit < 0:
            raise ValueError("rank contains invalid chars")
        value = (value * RANK_BASE) + digit
    return value


def lexorank_between(rank_left: Optional[str], rank_right: Optional[str]) -> str:
    left_int = _rank_text_to_int(rank_left) if rank_left else 0
    right_int = _rank_text_to_int(rank_right) if rank_right else RANK_INT_MAX
    if right_int - left_int <= 1:
        raise ValueError("no rank gap between left/right")
    rank_int = (left_int + right_int) // 2
    return _rank_int_to_text(rank_int)


def lexorank_initial() -> str:
    return lexorank_between(None, None)
