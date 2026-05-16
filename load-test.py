#!/usr/bin/env python3
"""
Load test for Wedding Album API
Simulates 40 photo uploads + 40 signature uploads
"""

import requests
import time
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, ImageDraw, ImageFont
import random
import string

BASE_URL = "https://memories-wedding.vercel.app"
PHOTO_ENDPOINT = f"{BASE_URL}/api/photos"
SIGNATURE_ENDPOINT = f"{BASE_URL}/api/photos/signature"
GET_ENDPOINT = f"{BASE_URL}/api/photos"

# Results storage
results = {
    "photo_uploads": [],
    "signature_uploads": [],
    "get_requests": [],
    "errors": [],
}

def create_test_photo(index: int, size_kb: int = 50) -> str:
    """Create a test photo JPEG file of approximately the given size"""
    width = 400
    height = 300
    img = Image.new('RGB', (width, height), color=(
        random.randint(50, 200),
        random.randint(50, 200),
        random.randint(50, 200)
    ))
    draw = ImageDraw.Draw(img)
    
    # Add some variety
    for _ in range(10):
        x1, y1 = random.randint(0, width), random.randint(0, height)
        x2, y2 = random.randint(0, width), random.randint(0, height)
        color = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        draw.rectangle([min(x1,x2), min(y1,y2), max(x1,x2), max(y1,y2)], fill=color)
    
    # Add text
    draw.text((20, 20), f"Photo #{index}", fill=(255, 255, 255))
    draw.text((20, 50), f"Test Load", fill=(255, 255, 255))
    
    filepath = f"/tmp/load-test-photo-{index}.jpg"
    img.save(filepath, 'JPEG', quality=80)
    return filepath

def create_test_signature(index: int) -> str:
    """Create a test signature PNG file"""
    width = 300
    height = 100
    img = Image.new('RGB', (width, height), color=(255, 250, 243))
    draw = ImageDraw.Draw(img)
    
    # Draw a wavy "signature" line
    points = []
    x = 20
    for i in range(15):
        y = 50 + random.randint(-25, 25)
        points.append((x, y))
        x += 18
    
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=(74, 26, 107), width=2)
    
    # Add name
    name = f"Guest {index}"
    draw.text((20, 70), name, fill=(74, 26, 107))
    
    filepath = f"/tmp/load-test-sig-{index}.png"
    img.save(filepath, 'PNG')
    return filepath

def upload_photo(index: int) -> dict:
    """Upload a single photo and return timing info"""
    guest_names = ["Ana", "Bruno", "Carla", "Diego", "Elena", "Fábio", "Gabi", "Hugo", "Isa", "João",
                   "Lara", "Marcos", "Nina", "Oscar", "Patrícia", "Samuel", "Teresa", "Ulisses", "Vanessa", "Wesley"]
    frames = ["classic", "floral", "modern"]
    messages = [
        "Muitas felicidades!", "Parabéns ao casal!", "Amor eterno!", "Que Deus abençoe!",
        "Felicidades!", "Vida longa e feliz!", "Muito amor!", "Sempre juntos!",
        "Lindo casamento!", "Que alegria!", "", "", "", ""  # some empty messages
    ]
    
    filepath = create_test_photo(index)
    guest_name = f"{random.choice(guest_names)} Convidado{index}"
    frame = random.choice(frames)
    message = random.choice(messages)
    
    start = time.time()
    try:
        with open(filepath, 'rb') as f:
            files = {'photo': (f'photo-{index}.jpg', f, 'image/jpeg')}
            data = {
                'guestName': guest_name,
                'frame': frame,
                'message': message,
            }
            resp = requests.post(PHOTO_ENDPOINT, files=files, data=data, timeout=60)
        elapsed = time.time() - start
        
        result = {
            "index": index,
            "status": resp.status_code,
            "elapsed": round(elapsed, 2),
            "success": resp.status_code == 200,
            "guest_name": guest_name,
            "frame": frame,
        }
        
        if resp.status_code == 200:
            body = resp.json()
            result["photo_id"] = body.get("photo", {}).get("id")
            result["cloudinary_url"] = body.get("photo", {}).get("cloudinaryUrl", "")[:80]
            result["cloudinary_id"] = body.get("photo", {}).get("cloudinaryId")
            is_cloudinary = "res.cloudinary.com" in result["cloudinary_url"]
            result["storage"] = "cloudinary" if is_cloudinary else "base64"
        else:
            result["error"] = resp.text[:200]
            
        return result
    except Exception as e:
        elapsed = time.time() - start
        return {
            "index": index,
            "status": 0,
            "elapsed": round(elapsed, 2),
            "success": False,
            "error": str(e)[:200],
        }
    finally:
        os.remove(filepath) if os.path.exists(filepath) else None

def upload_signature(index: int, photo_id: str) -> dict:
    """Upload a signature for a given photo and return timing info"""
    guest_names = ["Ana", "Bruno", "Carla", "Diego", "Elena", "Fábio", "Gabi", "Hugo", "Isa", "João"]
    
    filepath = create_test_signature(index)
    guest_name = f"{random.choice(guest_names)} Assinante{index}"
    
    start = time.time()
    try:
        with open(filepath, 'rb') as f:
            files = {'signature': (f'sig-{index}.png', f, 'image/png')}
            data = {
                'photoId': photo_id,
                'guestName': guest_name,
            }
            resp = requests.post(SIGNATURE_ENDPOINT, files=files, data=data, timeout=60)
        elapsed = time.time() - start
        
        result = {
            "index": index,
            "photo_id": photo_id,
            "status": resp.status_code,
            "elapsed": round(elapsed, 2),
            "success": resp.status_code == 200,
            "guest_name": guest_name,
        }
        
        if resp.status_code == 200:
            body = resp.json()
            result["sig_cloudinary_url"] = body.get("signature", {}).get("cloudinaryUrl", "")[:80]
            is_cloudinary = "res.cloudinary.com" in result.get("sig_cloudinary_url", "")
            result["storage"] = "cloudinary" if is_cloudinary else "base64"
        else:
            result["error"] = resp.text[:200]
            
        return result
    except Exception as e:
        elapsed = time.time() - start
        return {
            "index": index,
            "photo_id": photo_id,
            "status": 0,
            "elapsed": round(elapsed, 2),
            "success": False,
            "error": str(e)[:200],
        }
    finally:
        os.remove(filepath) if os.path.exists(filepath) else None

def test_get_photos() -> dict:
    """Test GET /api/photos endpoint"""
    start = time.time()
    try:
        resp = requests.get(GET_ENDPOINT, timeout=60)
        elapsed = time.time() - start
        body = resp.json()
        photos = body.get("photos", [])
        return {
            "status": resp.status_code,
            "elapsed": round(elapsed, 2),
            "success": resp.status_code == 200,
            "total_photos": len(photos),
            "cloudinary_count": sum(1 for p in photos if "res.cloudinary.com" in p.get("cloudinaryUrl", "")),
            "base64_count": sum(1 for p in photos if p.get("cloudinaryUrl", "").startswith("data:")),
            "regular_photos": sum(1 for p in photos if not p.get("isSignature")),
            "signatures": sum(1 for p in photos if p.get("isSignature")),
        }
    except Exception as e:
        elapsed = time.time() - start
        return {"status": 0, "elapsed": round(elapsed, 2), "success": False, "error": str(e)[:200]}

def print_summary(results: dict):
    """Print a nice summary of the load test"""
    photo_results = results["photo_uploads"]
    sig_results = results["signature_uploads"]
    
    print("\n" + "=" * 80)
    print("📊  LOAD TEST SUMMARY - Álbum de Casamento Virtual")
    print("=" * 80)
    
    # Photo uploads
    if photo_results:
        successes = [r for r in photo_results if r["success"]]
        failures = [r for r in photo_results if not r["success"]]
        times = [r["elapsed"] for r in successes]
        
        print(f"\n📸  PHOTO UPLOADS ({len(photo_results)} requests)")
        print("-" * 50)
        print(f"  ✅ Success: {len(successes)}/{len(photo_results)} ({len(successes)/len(photo_results)*100:.1f}%)")
        print(f"  ❌ Failed:  {len(failures)}/{len(photo_results)}")
        if times:
            print(f"  ⏱  Avg time:   {sum(times)/len(times):.2f}s")
            print(f"  ⏱  Min time:   {min(times):.2f}s")
            print(f"  ⏱  Max time:   {max(times):.2f}s")
            print(f"  ⏱  Total time: {sum(times):.2f}s")
        
        cloudinary_count = sum(1 for r in successes if r.get("storage") == "cloudinary")
        base64_count = sum(1 for r in successes if r.get("storage") == "base64")
        print(f"  ☁️  Cloudinary: {cloudinary_count}")
        print(f"  📦 Base64:     {base64_count}")
    
    # Signature uploads
    if sig_results:
        successes = [r for r in sig_results if r["success"]]
        failures = [r for r in sig_results if not r["success"]]
        times = [r["elapsed"] for r in successes]
        
        print(f"\n✍️  SIGNATURE UPLOADS ({len(sig_results)} requests)")
        print("-" * 50)
        print(f"  ✅ Success: {len(successes)}/{len(sig_results)} ({len(successes)/len(sig_results)*100:.1f}%)")
        print(f"  ❌ Failed:  {len(failures)}/{len(sig_results)}")
        if times:
            print(f"  ⏱  Avg time:   {sum(times)/len(times):.2f}s")
            print(f"  ⏱  Min time:   {min(times):.2f}s")
            print(f"  ⏱  Max time:   {max(times):.2f}s")
            print(f"  ⏱  Total time: {sum(times):.2f}s")
        
        cloudinary_count = sum(1 for r in successes if r.get("storage") == "cloudinary")
        base64_count = sum(1 for r in successes if r.get("storage") == "base64")
        print(f"  ☁️  Cloudinary: {cloudinary_count}")
        print(f"  📦 Base64:     {base64_count}")
    
    # GET endpoint
    if results["get_requests"]:
        print(f"\n📋  GET /api/photos")
        print("-" * 50)
        for r in results["get_requests"]:
            print(f"  Status: {r['status']} | Time: {r['elapsed']}s | Total: {r.get('total_photos', '?')} photos")
            print(f"  Cloudinary: {r.get('cloudinary_count', 0)} | Base64: {r.get('base64_count', 0)}")
            print(f"  Regular: {r.get('regular_photos', 0)} | Signatures: {r.get('signatures', 0)}")
    
    # Errors
    all_failures = [r for r in photo_results if not r["success"]] + [r for r in sig_results if not r["success"]]
    if all_failures:
        print(f"\n🚨  ERRORS ({len(all_failures)})")
        print("-" * 50)
        for f in all_failures[:5]:  # Show first 5
            print(f"  Index {f['index']}: status={f['status']}, error={f.get('error', 'unknown')[:100]}")
        if len(all_failures) > 5:
            print(f"  ... and {len(all_failures) - 5} more errors")
    
    # Overall
    all_results = photo_results + sig_results
    all_successes = [r for r in all_results if r["success"]]
    all_times = [r["elapsed"] for r in all_successes]
    
    print(f"\n🏁  OVERALL")
    print("-" * 50)
    print(f"  Total requests: {len(all_results)}")
    print(f"  Success rate: {len(all_successes)}/{len(all_results)} ({len(all_successes)/len(all_results)*100:.1f}%)")
    if all_times:
        print(f"  Avg response: {sum(all_times)/len(all_times):.2f}s")
        print(f"  Slowest: {max(all_times):.2f}s")
        print(f"  Fastest: {min(all_times):.2f}s")
    
    print("\n" + "=" * 80)


def main():
    NUM_PHOTOS = 40
    CONCURRENT_UPLOADS = 5  # concurrent uploads at a time
    
    print(f"🚀 Starting load test with {NUM_PHOTOS} photos + {NUM_PHOTOS} signatures")
    print(f"   Target: {BASE_URL}")
    print(f"   Concurrency: {CONCURRENT_UPLOADS} parallel uploads")
    print()
    
    # ─── Phase 1: GET before ─────────────────────
    print("📋 Phase 0: GET /api/photos (before uploads)...")
    get_before = test_get_photos()
    results["get_requests"].append(get_before)
    print(f"   → {get_before['total_photos']} existing photos | {get_before['elapsed']}s")
    print()
    
    # ─── Phase 2: Upload 40 photos ───────────────
    print(f"📸 Phase 1: Uploading {NUM_PHOTOS} photos...")
    phase1_start = time.time()
    
    with ThreadPoolExecutor(max_workers=CONCURRENT_UPLOADS) as executor:
        futures = {executor.submit(upload_photo, i): i for i in range(NUM_PHOTOS)}
        for future in as_completed(futures):
            result = future.result()
            results["photo_uploads"].append(result)
            status_icon = "✅" if result["success"] else "❌"
            storage_icon = "☁️" if result.get("storage") == "cloudinary" else "📦"
            print(f"   {status_icon} Photo #{result['index']:2d} | {result['elapsed']:5.2f}s | {storage_icon} {result.get('storage', '?')} | status={result['status']}")
    
    phase1_elapsed = time.time() - phase1_start
    print(f"\n   ⏱ Phase 1 total: {phase1_elapsed:.2f}s")
    print()
    
    # Collect successful photo IDs for signatures
    photo_ids = [r["photo_id"] for r in results["photo_uploads"] if r["success"] and r.get("photo_id")]
    print(f"   Got {len(photo_ids)} photo IDs for signatures")
    
    # ─── Phase 3: Upload 40 signatures ───────────
    sig_count = min(len(photo_ids), NUM_PHOTOS)
    print(f"\n✍️ Phase 2: Uploading {sig_count} signatures...")
    phase2_start = time.time()
    
    with ThreadPoolExecutor(max_workers=CONCURRENT_UPLOADS) as executor:
        futures = {
            executor.submit(upload_signature, i, photo_ids[i]): i 
            for i in range(sig_count)
        }
        for future in as_completed(futures):
            result = future.result()
            results["signature_uploads"].append(result)
            status_icon = "✅" if result["success"] else "❌"
            storage_icon = "☁️" if result.get("storage") == "cloudinary" else "📦"
            print(f"   {status_icon} Sig #{result['index']:2d} | {result['elapsed']:5.2f}s | {storage_icon} {result.get('storage', '?')} | photo={result['photo_id'][:12]}...")
    
    phase2_elapsed = time.time() - phase2_start
    print(f"\n   ⏱ Phase 2 total: {phase2_elapsed:.2f}s")
    print()
    
    # ─── Phase 4: GET after ──────────────────────
    print("📋 Phase 3: GET /api/photos (after uploads)...")
    get_after = test_get_photos()
    results["get_requests"].append(get_after)
    print(f"   → {get_after['total_photos']} total photos | {get_after['elapsed']}s")
    print(f"   → Regular: {get_after.get('regular_photos', 0)} | Signatures: {get_after.get('signatures', 0)}")
    print()
    
    # ─── Print Summary ───────────────────────────
    print_summary(results)
    
    # Save results to JSON
    with open("/home/z/my-project/download/load-test-results.json", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"💾 Results saved to /home/z/my-project/download/load-test-results.json")


if __name__ == "__main__":
    main()
