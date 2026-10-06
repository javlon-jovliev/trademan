"""Stage the pinned official SDK. Run from any directory; review IBKR license."""
import hashlib
import io
from pathlib import Path
import urllib.request
import zipfile

URL = "https://interactivebrokers.github.io/downloads/twsapi_macunix.1050.02.zip"
SHA256 = "673129e5cba58c4d77bc40647265f84ea42f605eccf88fa4c1221d62d12454f3"
root = Path(__file__).resolve().parent / "vendor" / "ibapi"
with urllib.request.urlopen(URL, timeout=60) as response:
    data = response.read()
if hashlib.sha256(data).hexdigest() != SHA256:
    raise SystemExit("IBKR SDK checksum mismatch; refusing extraction")
prefix = "IBJts/source/pythonclient/"
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    for name in archive.namelist():
        if not name.startswith(prefix) or name.endswith("/"):
            continue
        target = (root / name[len(prefix):]).resolve()
        if not target.is_relative_to(root.resolve()):
            raise SystemExit("Invalid SDK archive path")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.read(name))
print("Official IBKR SDK 10.50.2 staged and checksum verified")
