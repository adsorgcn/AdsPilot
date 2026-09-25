# 插件模板

复制整个目录到 `plugins/<kind>/<name>/`，改 manifest 与使用方法，写脚本，加 `--selftest`。
跑 `python3 core/selfcheck/validate.py --manifests` 通过就能被主干调用。主干一行不改。
