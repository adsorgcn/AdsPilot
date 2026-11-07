"""Exercise the scanner using disposable files, Git index blobs and outside-link canaries."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.agent.selfcheck import check_secrets_in_repo


# Synthetic only. The fixture is assembled in the temp directory, never in repository files.
SAMPLE = "gh" + "p_" + "scanfixture"
KEY = "sk" + "-" + "X" * 34


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content if isinstance(content,bytes) else content.encode("utf-8"))


def git(root, *args):
    result = subprocess.run(["git","-C",str(root),*args],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if result.returncode:
        raise AssertionError("could not prepare temporary Git fixture")


def expect(root, expected, case):
    result = check_secrets_in_repo(root)
    if result["status"] != expected or SAMPLE in json.dumps(result) or KEY in json.dumps(result):
        raise AssertionError(case)
    if expected == "fail" and "matched" not in result["detail"]:
        raise AssertionError(case + " did not identify a match")


def linked_directory(target, link):
    if os.name == "nt":
        import _winapi
        _winapi.CreateJunction(str(target),str(link))
    else:
        link.symlink_to(target,target_is_directory=True)


def main():
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)/"repo"
        root.mkdir()
        for rel in ("data/private.txt","runs/report.json","site/unpublished.html",
                    "config/adspilot.json",".env",".env.local"):
            write(root/rel,SAMPLE)
        expect(root,"pass","non-Git private data")
        loose = root/"plugins/sample/data/ordinary.py"
        write(loose,KEY)
        expect(root,"fail","non-Git ordinary nested source")
        write(loose,"ordinary source")
        expect(root,"pass","clean non-Git archive")

        git(root,"init","-q")
        write(root/".gitignore","data/\nruns/\nsite/\n.env*\n*.db\nconfig/adspilot.json\n")
        git(root,"add",".gitignore")
        git(root,"add","-f","plugins/sample/data/ordinary.py")
        expect(root,"pass","Git private untracked data")
        write(root/"loose.py",KEY)
        expect(root,"fail","Git ordinary untracked source")
        (root/"loose.py").unlink()

        for rel,note,codec in (("plugins/sample/data/ordinary.py","nested plugin data","utf-16"),
                               ("data/forced.db","force-added root binary extension","utf-16-le"),
                               ("runs/forced.txt","force-added root run","utf-16-be")):
            # The token spans two scanning blocks in each encoding.
            write(root/rel,("x"*32766+" "+SAMPLE).encode(codec))
            git(root,"add","-f","--",rel)
            write(root/rel,"working copy clean")
            expect(root,"fail",note+" present in staged blob alone")
            git(root,"add","-f","--",rel)
            write(root/rel,KEY.encode(codec))
            expect(root,"fail",note+" present in working file alone")
            write(root/rel,"working copy clean")
            expect(root,"pass",note+" restored")

        named = root/"plugins"/(SAMPLE+".txt")
        write(named,"safe content")
        git(root,"add","--",str(named.relative_to(root)))
        expect(root,"fail","sensitive path not printed")
        git(root,"rm","-q","-f","--",str(named.relative_to(root)))
        expect(root,"pass","clean after removing sensitive name")

        outside=Path(temp)/"outside"
        write(outside/"source.py",SAMPLE)
        link=root/"external-file.txt"
        try:
            link.symlink_to(outside/"source.py")
        except (OSError,NotImplementedError):
            if os.name != "nt":
                raise
        else:
            git(root,"add","--",str(link.relative_to(root)))
            expect(root,"pass","external file symlink")
        nested=root/"tracked-tree"
        write(nested/"source.py","clean tracked source")
        git(root,"add","--","tracked-tree/source.py")
        (nested/"source.py").unlink()
        nested.rmdir()
        linked_directory(outside,nested)
        expect(root,"pass","tracked parent replaced with external symlink or junction")
        if os.name=="nt":
            nested.rmdir()
        else:
            nested.unlink()
    print("secret scan selftest: clean/archive/untracked, staged and working UTF-16, private roots, sensitive name and outside links OK")


if __name__=="__main__":
    main()
