---
title: Loom Testing
tags:
  - loom
  - lotus
  - testing
  - execution-groups
  - containers
lotus-execution: native
lotus-cwd: .
lotus-timeout: "16000"
---

# Lotus Testing & Execution Groups

This note documents the various ways to configure and execute code blocks within Obsidian using **Loom** (internal plugin name **Lotus**). By default, code blocks execute locally on your host machine. For isolation and cross-platform testing, Loom supports **Execution Groups** that delegate execution to Docker/Podman, WSL, or remote SSH servers.

---

## 🚀 Execution Environments

Each code block resolves its execution target through an override stack: `Global Settings ➔ Note Frontmatter ➔ Block Attributes`. 

To force a code block to run inside a specific environment, use the `lotus-execution` attribute on the code block fence. Below are the preconfigured test environments available in this vault:

### 1. Native Windows Host (`native`)
Runs the code block directly on your local Windows host machine using your local Python installation. This is the default behavior if no execution group is configured.

```python 
import sys
import platform

print("Hello from Native Windows!")
print(f"Python version: {sys.version}")
print(f"OS Platform: {platform.platform()}")
```

### 2. Docker Container (`docker_test`)
Runs the code block isolated inside a lightweight Docker container. The plugin mounts the workspace/temp files and executes the code within the container image.

> [!TIP]
> This is ideal for testing code against specific Python versions or isolated environments without cluttering your host machine.

```python lotus-execution=docker_test
import sys
import platform

print("🐳 Hello from Docker!")
print(f"Python version: {sys.version}")
print(f"OS Platform: {platform.platform()}")
```

### 3. WSL Environment (`wsl_test`)
Executes the code block inside Windows Subsystem for Linux (WSL). This is perfect for Windows users who need a Linux-native runtime for compiling C/C++, running shell scripts, or using tools that only work under Linux.

```python lotus-execution=wsl_test
import platform
import os

print("🐧 Hello from WSL!")
print(f"OS Platform: {platform.platform()}")
print(f"Kernel Release: {platform.release()}")
```

### 4. SSH Remote Host (`ssh_remote`)
Runs commands on a remote SSH host. The plugin copies the code block snippet as a temporary file via SCP, executes it over SSH, and cleans up the remote file after execution.

> [!IMPORTANT]
> Make sure your SSH keys are added to your local SSH agent so the plugin can authenticate without password prompts.

```python lotus-execution=ssh_remote
import os
import socket

print("🌐 Hello from SSH Remote!")
print(f"Hostname: {socket.gethostname()}")
print(f"Remote OS: {os.name}")
```

---

## ✂️ Partial Source Extraction

Loom can run parts of another file in your workspace while keeping the calling site in your note. This allows you to document code, write live harnesses, or run tests against existing files without duplication.

Use the following attributes:
* `lotus-file="<path>"`: The path to the file relative to the vault root (starting with `/`) or relative to the note.
* `lotus-symbol="<name>"`: The specific function, class, or definition to extract.

### Demonstration: Factoring out code from `math_demo.py`

We have created a demo file [[math_demo.py]] in the vault root containing mathematical utility functions (`calculate_factorial`, `is_prime`, `fibonacci`, and `greatest_common_divisor`). We can extract them and run a test harness for each:

#### 1. Extracting `calculate_factorial`
```python lotus-file="math_demo.py" lotus-symbol=calculate_factorial
# 'calculate_factorial' is automatically extracted and prepended to this block.
# We can call it directly as if it were defined here.

for i in range(1, 7):
    print(f"Factorial of {i} is {calculate_factorial(i)}")
```

#### 2. Extracting `is_prime`
```python lotus-file="math_demo.py" lotus-symbol=is_prime
# 'is_prime' is automatically extracted and prepended to this block.

numbers = [2, 3, 4, 17, 20, 97, 100]
primes = [num for num in numbers if is_prime(num)]
print(f"Primes in list {numbers}: {primes}")
```

#### 3. Extracting `fibonacci`
```python lotus-file="math_demo.py" lotus-symbol=fibonacci
# 'fibonacci' is automatically extracted and prepended to this block.

for i in range(10):
    print(f"Fibonacci({i}) = {fibonacci(i)}")
```

> [!NOTE]
> By default, the extractor also pulls in imports and dependencies that the symbol relies on. You can disable this recursive dependency tracing by setting `lotus-deps=false`.
