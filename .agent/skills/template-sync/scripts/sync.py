#!/usr/bin/env python3
import os
import shutil
import hashlib
import sys
import json
import argparse
import re


# Resolve paths dynamically relative to this script's location
# c:\Users\thomy\Obsidian notes\.agent\skills\template-sync\scripts\sync.py
# 4 levels up reaches the vault root
SOURCE_VAULT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DEFAULT_DEST_VAULT = os.path.abspath(os.path.join(SOURCE_VAULT, "..", "Obsidian-System-Template"))

# Relative paths of settings, scripts, and templates to sync
WHITELIST = [
    r"090 System/000 Templates",
    r".agent/skills",
    r".obsidian/plugins",
    r".obsidian/snippets",
    r".obsidian/themes",
    r".obsidian/app.json",
    r".obsidian/appearance.json",
    r".obsidian/community-plugins.json",
    r".obsidian/core-plugins.json",
    r".obsidian/daily-notes.json",
    r".obsidian/graph.json",
    r".obsidian/hotkeys.json",
    r".obsidian/types.json",
    r"000 Home MOC.md",
    r"090 Atlas.md",
    r"AI.md",
    r".cursorrules"
]

IGNORE_PATTERNS = [
    "workspace.json",
    ".DS_Store",
    "Thumbs.db",
    ".git",
    ".stfolder",
    ".stversions",
    ".trash"
]

def calculate_md5(filepath):
    try:
        hasher = hashlib.md5()
        with open(filepath, 'rb') as f:
            buf = f.read(65536)
            while len(buf) > 0:
                hasher.update(buf)
                buf = f.read(65536)
        return hasher.hexdigest()
    except Exception as e:
        print(f"Error reading file {filepath}: {e}")
        return None

def calculate_string_md5(s):
    hasher = hashlib.md5()
    hasher.update(s.encode('utf-8'))
    return hasher.hexdigest()

def should_ignore(rel_path):
    parts = rel_path.replace("\\", "/").split("/")
    for p in parts:
        if p in IGNORE_PATTERNS or p.endswith(".env"):
            return True
    return False

def is_secret_key(key):
    key_lower = key.lower()
    # Exclude false positives that contain config keywords
    if "modelkey" in key_lower or "chaintype" in key_lower:
        return False
    # Matches standard API key and token patterns
    secret_words = ["apikey", "api_key", "accesstoken", "access_token", "token", "licensekey", "password", "secret"]
    return any(word in key_lower for word in secret_words)

def strip_secrets_from_json(data, file_label=""):
    modified = False
    if isinstance(data, dict):
        for k, v in list(data.items()):
            if isinstance(v, str) and v != "" and is_secret_key(k):
                print(f"  [SECURITY] Stripping credential in key '{k}' from '{file_label}'")
                data[k] = ""
                modified = True
            elif isinstance(v, (dict, list)):
                if strip_secrets_from_json(v, file_label):
                    modified = True
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, (dict, list)):
                if strip_secrets_from_json(item, file_label):
                    modified = True
    return modified

def strip_student_name_from_markdown(content):
    # Regex to find frontmatter: starts with --- on first line, ends with --- on subsequent line
    pattern = r"^---\r?\n(.*?)\r?\n---"
    match = re.match(pattern, content, re.DOTALL | re.MULTILINE)
    if match:
        frontmatter = match.group(1)
        # Find student_name: followed by some non-whitespace chars (so we ignore already empty ones)
        fm_pattern = r"^(student_name:\s*)(?:\S[^\r\n]*)"
        new_frontmatter, count = re.subn(fm_pattern, r"\1", frontmatter, flags=re.MULTILINE | re.IGNORECASE)
        if count > 0:
            return content[:match.start(1)] + new_frontmatter + content[match.end(1):]
    return None

def process_source_file(src_full, rel_path):
    # Returns (content_string_if_modified, is_processed)
    if rel_path.endswith(".json"):
        try:
            with open(src_full, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if strip_secrets_from_json(data, rel_path):
                # Format with indentation to preserve clean formatting
                return json.dumps(data, indent=2, ensure_ascii=False), True
            return None, True
        except Exception as e:
            print(f"Error processing JSON {rel_path}: {e}")
            return None, True
            
    elif rel_path.endswith(".md"):
        try:
            with open(src_full, 'r', encoding='utf-8') as f:
                content = f.read()
            stripped = strip_student_name_from_markdown(content)
            if stripped is not None:
                print(f"  [SECURITY] Stripping student_name from frontmatter of '{rel_path}'")
                return stripped, True
            return None, True
        except Exception as e:
            print(f"Error processing Markdown {rel_path}: {e}")
            return None, True
            
    return None, False

def get_source_files(source_vault):
    source_files = {}
    for item in WHITELIST:
        src_full = os.path.abspath(os.path.join(source_vault, item))
        if not os.path.exists(src_full):
            continue
            
        if os.path.isfile(src_full):
            rel_path = os.path.relpath(src_full, source_vault)
            if not should_ignore(rel_path):
                source_files[rel_path] = src_full
        elif os.path.isdir(src_full):
            for root, dirs, files in os.walk(src_full):
                # Exclude ignored dirs in-place
                dirs[:] = [d for d in dirs if d not in IGNORE_PATTERNS]
                for file in files:
                    full_file = os.path.join(root, file)
                    rel_path = os.path.relpath(full_file, source_vault)
                    if not should_ignore(rel_path):
                        source_files[rel_path] = full_file
    return source_files

def get_dest_files_in_whitelist(dest_vault):
    dest_files = {}
    for item in WHITELIST:
        dest_full = os.path.abspath(os.path.join(dest_vault, item))
        if not os.path.exists(dest_full):
            continue
            
        if os.path.isfile(dest_full):
            rel_path = os.path.relpath(dest_full, dest_vault)
            if not should_ignore(rel_path):
                dest_files[rel_path] = dest_full
        elif os.path.isdir(dest_full):
            for root, dirs, files in os.walk(dest_full):
                dirs[:] = [d for d in dirs if d not in IGNORE_PATTERNS]
                for file in files:
                    full_file = os.path.join(root, file)
                    rel_path = os.path.relpath(full_file, dest_vault)
                    if not should_ignore(rel_path):
                        dest_files[rel_path] = full_file
    return dest_files

def main():
    parser = argparse.ArgumentParser(description="Synchronize system templates, skills, and plugins from active vault to system template repo.")
    parser.add_argument("--force", action="store_true", help="Actually copy the files (defaults to dry-run).")
    parser.add_argument("--prune", action="store_true", help="Delete files in destination whitelisted paths that no longer exist in source.")
    parser.add_argument("--dest", default=DEFAULT_DEST_VAULT, help=f"Path to the destination template vault (default: {DEFAULT_DEST_VAULT})")
    
    args = parser.parse_args()
    dest_vault = os.path.abspath(args.dest)
    
    print(f"Source Vault:      {SOURCE_VAULT}")
    print(f"Destination Vault: {dest_vault}")
    print(f"Mode:              {'REAL RUN' if args.force else 'DRY RUN (preview only - use --force to apply)'}")
    print(f"Pruning:           {'ENABLED' if args.prune else 'DISABLED (use --prune to delete extra files in dest)'}")
    print("-" * 60)
    
    if not os.path.exists(dest_vault):
        print(f"Error: Destination vault path '{dest_vault}' does not exist.")
        sys.exit(1)
        
    source_files = get_source_files(SOURCE_VAULT)
    dest_files = get_dest_files_in_whitelist(dest_vault)
    
    copied_count = 0
    updated_count = 0
    pruned_count = 0
    skipped_count = 0
    
    # 1. Sync / Copy
    for rel_path, src_full in sorted(source_files.items()):
        dest_full = os.path.join(dest_vault, rel_path)
        
        # Check if the file needs secret stripping
        stripped_content, is_json = process_source_file(src_full, rel_path)
        
        if not os.path.exists(dest_full):
            # New file
            print(f"[NEW] {rel_path} {'(API credentials stripped)' if stripped_content else ''}")
            copied_count += 1
            if args.force:
                os.makedirs(os.path.dirname(dest_full), exist_ok=True)
                if stripped_content:
                    with open(dest_full, 'w', encoding='utf-8') as f:
                        f.write(stripped_content)
                else:
                    shutil.copy2(src_full, dest_full)
        else:
            # Existing file - compare MD5
            if stripped_content:
                src_md5 = calculate_string_md5(stripped_content)
            else:
                src_md5 = calculate_md5(src_full)
                
            dest_md5 = calculate_md5(dest_full)
            
            if src_md5 != dest_md5:
                print(f"[MODIFIED] {rel_path} {'(API credentials stripped)' if stripped_content else ''}")
                updated_count += 1
                if args.force:
                    if stripped_content:
                        with open(dest_full, 'w', encoding='utf-8') as f:
                            f.write(stripped_content)
                    else:
                        shutil.copy2(src_full, dest_full)
            else:
                skipped_count += 1
                
    # 2. Prune
    if args.prune:
        for rel_path, dest_full in sorted(dest_files.items()):
            if rel_path not in source_files:
                print(f"[DELETE] {rel_path}")
                pruned_count += 1
                if args.force:
                    try:
                        os.remove(dest_full)
                        # Optionally remove empty parent directories
                        parent_dir = os.path.dirname(dest_full)
                        while parent_dir and parent_dir != dest_vault:
                            if not os.listdir(parent_dir):
                                os.rmdir(parent_dir)
                                parent_dir = os.path.dirname(parent_dir)
                            else:
                                break
                    except Exception as e:
                        print(f"Error deleting {dest_full}: {e}")
                        
    print("-" * 60)
    print("Summary of actions:")
    print(f"  New files copied:       {copied_count}")
    print(f"  Files updated:          {updated_count}")
    print(f"  Files pruned (deleted): {pruned_count}")
    print(f"  Files already in sync:  {skipped_count}")
    
    if not args.force and (copied_count > 0 or updated_count > 0 or pruned_count > 0):
        print("\n*** This was a DRY RUN. No changes were written. Run with --force to apply changes. ***")

if __name__ == "__main__":
    main()
