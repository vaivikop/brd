"""
Download Meeting Dialogue data from HuggingFace (DialogSum - open dataset)

Usage: python scripts/download-ami.py

This will download meeting transcripts and save them to:
  public/datasets/ami/meetings_sample.json
"""

import json
import os
from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    print("Installing datasets library...")
    os.system("pip install datasets")
    from datasets import load_dataset

print("\n📋 Meeting Corpus Downloader")
print("============================\n")

# Create output directory
output_dir = Path(__file__).parent.parent / "public" / "datasets" / "ami"
output_dir.mkdir(parents=True, exist_ok=True)

print("Downloading DialogSum from HuggingFace (open alternative to AMI)...")
print("(This may take a few minutes on first run)\n")

# Load DialogSum dataset - open and has business dialogues
dataset = load_dataset("knkarthick/dialogsum")

# Process meetings
meetings = []
seen_ids = set()

# Process train split (largest)
for split_name in ['train', 'validation', 'test']:
    if split_name in dataset:
        for item in dataset[split_name]:
            meeting_id = item.get('id', f'meeting_{len(meetings)}')
            
            # Skip duplicates
            if meeting_id in seen_ids:
                continue
            seen_ids.add(meeting_id)
            
            # Build meeting object
            meeting = {
                'id': f'ami_{len(meetings)}',
                'meeting_id': meeting_id,
                'scenario': 'Product Design Meeting',
                'dialogue': item.get('dialogue', ''),
                'summary': item.get('summary', ''),
                'topic': item.get('topic', 'General Discussion'),
            }
            
            # Parse dialogue into turns if it's a string
            dialogue_text = item.get('dialogue', '')
            if dialogue_text:
                # Try to parse dialogue turns
                turns = []
                current_speaker = 'Speaker'
                for line in dialogue_text.split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    if ':' in line:
                        parts = line.split(':', 1)
                        current_speaker = parts[0].strip()
                        text = parts[1].strip() if len(parts) > 1 else ''
                    else:
                        text = line
                    
                    if text:
                        turns.append({
                            'speaker': current_speaker,
                            'text': text
                        })
                
                meeting['transcript'] = turns
            
            meetings.append(meeting)
            
            if len(meetings) >= 100:
                break
    
    if len(meetings) >= 100:
        break

print(f"✅ Processed {len(meetings)} meetings\n")

# Save to JSON
output_file = output_dir / "meetings_sample.json"
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(meetings, f, indent=2, ensure_ascii=False)

print(f"💾 Saved to: {output_file}")
print(f"\n🎉 Done! You can now use AMI data in the app.")
print(f"   Go to Data Sources → Load Sample on AMI card\n")

# Print sample
if meetings:
    print("Sample meeting:")
    print(f"  ID: {meetings[0]['meeting_id']}")
    print(f"  Topic: {meetings[0].get('topic', 'N/A')}")
    if meetings[0].get('summary'):
        print(f"  Summary: {meetings[0]['summary'][:200]}...")
