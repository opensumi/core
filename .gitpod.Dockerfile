FROM gitpod/workspace-full:latest

RUN bash -c 'VERSION="14.19.3" \
  && source $HOME/.nvm/nvm.sh && nvm install $VERSION \
  && nvm use $VERSION && nvm alias default $VERSION'

RUN echo "nvm use default &>/dev/null" >> ~/.bashrc.d/51-nvm-fix

RUN apt-get update && apt-get install -y \
  build-essential \
  g++ \
  libx11-dev \
  libxkbfile-dev \
  libsecret-1-dev \
  python-is-python3 \
  && rm -rf /var/lib/apt/lists/*
