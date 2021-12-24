#!/usr/bin/env bash

## 使用镜像源安装 OpenSumi 脚本
## version 0.0.1
## 由于部分用户安装依赖等待过长，而且容易失败，所有有了这个脚本

set -e;
# set -x;

# 字符串格式化
if [[ -t 1 ]]; then
  tty_escape() { printf "\033[%sm" "$1"; }
else
  tty_escape() { :; }
fi
tty_mkbold() { tty_escape "1;$1"; }
tty_underline="$(tty_escape "4;39")"
tty_blue="$(tty_mkbold 34)"
tty_red="$(tty_mkbold 31)"
tty_bold="$(tty_mkbold 39)"
tty_reset="$(tty_escape 0)"

chomp() {
  printf "%s" "${1/"$'\n'"/}"
}

warn() {
  printf "${tty_red}%s${tty_reset}\n" "$(chomp "$1")"
}

tips() {
  printf "${tty_bold}%s${tty_reset}\n" "$(chomp "$1")"
}

execute() {
  $@
}


# read arguments
declare -a args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
  --force-clean)
    readonly forceClean="$2"
    shift 2
    ;;
  *)
    args[${#args[*]}]="$1"
    shift
    ;;
  esac
done

# project dir
SHELL_DIR=$(cd "$(dirname "$0")";pwd)
PROJECT_DIR=$(dirname $SHELL_DIR)

# ======================= 正式处理 =======================
read -ep "确认使用镜像源安装依赖(Y/n/q):" is_start
if [[ $is_start = "n" ]]; then
  exit 0
elif [[ $is_start = 'q' ]]; then
  exit 0
fi
tips ------------------
tips



tips "当前项目环境路径 $PROJECT_DIR"

tips
tips "1. 修改为 npmmirror 镜像源"
execute cp -f "$PROJECT_DIR/scripts/npmrc-cn" "$PROJECT_DIR/.npmrc"

tips
tips "2. 判断是否为强制清理缓存"


if [[ "$forceClean" = "true" ]]; then
  if command -v npm &> /dev/null; then
    warn "开始强制清理 npm 缓存..."
    echo npm cache clean --force
    execute npm cache clean --force
  else
    warn "没有 npm 环境，退出..."
    exit
  fi

  if command -v npm &> /dev/null; then
    warn "开始强制清理 yarn 缓存..."
    echo yarn cache clean --all
    execute yarn cache clean --all
  fi
fi

tips
tips "3. 使用 yarn 安装依赖"
cd $PROJECT_DIR
execute yarn

# 4. 如果返回错误，重新试安装依赖
# TODO

tips
tips "5. 结束"
tips 依赖安装结束
