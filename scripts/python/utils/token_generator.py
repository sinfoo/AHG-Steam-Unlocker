"""
AHG Steam Unlocker - Token Generator
Generates HMAC-signed tokens that can only be used once.
"""
import os
import random
import string
import hashlib
import hmac

_secret = os.environ.get("AHG_HMAC_SECRET")
TOKEN_SECRET = _secret.encode() if _secret else os.urandom(32)

def generate_signed_token():
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    
    part1 = ''.join(random.choices(chars, k=4))
    part2 = ''.join(random.choices(chars, k=4))
    part3 = ''.join(random.choices(chars, k=4))
    part4 = ''.join(random.choices(chars, k=4))
    
    data = f"AHG-{part1}-{part2}-{part3}-{part4}"
    signature = hmac.new(TOKEN_SECRET, data.encode(), hashlib.sha256).hexdigest()[:8].upper()
    
    return f"{data}-{signature}"

if __name__ == "__main__":
    print("=" * 50)
    print("AHG Steam Unlocker - Token Generator")
    print("=" * 50)
    print()
    
    try:
        count = int(input("How many tokens to generate? (1-100): ").strip())
        count = max(1, min(100, count))
    except:
        count = 1
    
    print()
    tokens = [generate_signed_token() for _ in range(count)]
    
    print("Generated Tokens:")
    print("-" * 60)
    for i, token in enumerate(tokens, 1):
        print(f"{i:3}. {token}")
    print("-" * 60)
    print()
    print("Each token can only be used ONCE on ONE device.")
    print("Tokens are verified with HMAC signature.")
    print()
    
    save = input("Save tokens to file? (y/n): ").strip().lower()
    if save == 'y':
        with open(data_path("generated_tokens.txt"), "w") as f:
            f.write("AHG Steam Unlocker - Generated Tokens\n")
            f.write("=" * 50 + "\n\n")
            for token in tokens:
                f.write(f"{token}\n")
        print("Saved to generated_tokens.txt")
