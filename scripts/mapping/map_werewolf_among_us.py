from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.mapping._map_common import (
    load_interim_events,
    map_events_to_records,
    write_mapped_output,
)


SOURCE = "werewolf_among_us"


def main() -> None:
    parser = argparse.ArgumentParser(description="Map werewolf_among_us interim events to BOTC schema.")
    parser.add_argument(
        "--script-tag",
        default="werewolf_transfer",
        help="Target script enum value in botc label schema.",
    )
    args = parser.parse_args()

    events = load_interim_events(SOURCE)
    records, errors = map_events_to_records(events, script_value=args.script_tag)
    for rec in records:
        rec["evidence_source"] = "social_read"
        rec["field_provenance"]["evidence_source"] = "source_default"
    summary = write_mapped_output(SOURCE, records, errors)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
