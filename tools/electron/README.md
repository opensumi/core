# Kaitian IDE Electron 实践层

## Electron 版本运行步骤
```shell
cd ../../
tnpm i
tnpm run init

cd tools/electron
tnpm i
tnpm run link-local
tnpm run build
tnpm run rebuild-native -- --force-rebuild=true
tnpm run start
```
