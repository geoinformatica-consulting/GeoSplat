# cesium-gaussian-splatting

An experiment to use gaussian splat data  with CesiumJS and the Three.js based Gaussian splatting viewer from [@mkkellogg/gaussian-splats-3d](https://github.com/mkkellogg/GaussianSplats3D)

> [Demo on Github Pages](https://tebben.github.io/cesium-gaussian-splatting/)

![Alt text](./img/screenshot_1.webp?raw=true "Gaussian Splatting in CesiumJS")


# Prerequisities for Github Repo
### Authorizing using ssh git credentials using Git
1. Create a new key pair using the ed25519 or rsa algorithm:
```bash
# ssh-keygen -t rsa -b 4096 -C "<your email>@domain.com" -f ~/.ssh/id_rsa_company1

# If using ed25519 algorithm use:
ssh-keygen -t ed25519 -C "<your email>@domain.com" -f ~/.ssh/id_ed25519_company1

# Enter a password and remember this. You will need it each time you pull/push to the repo

# Print out the public key
cat ~/.ssh/id_ed25519_company1.pub
```
Take this key and paste it into the Azure DevOps git settings under new SSH key.

2. Create a ~/.ssh/config with this:
```bash
# if the ~/.ssh/config doesn't exist, then create and edit the file:
touch ~/.ssh/config
nano ~/.ssh/config

## GitHub
# We're not currently using Azure DevOps, but if we need in the future, this can be used. The top one is for regular use with your Github personal account.
Host github
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes

Host company1-github
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_<company1name>
  IdentitiesOnly yes

# Azure DevOps
Host company2-devops
  HostName ssh.dev.azure.com
  User git
  IdentityFile ~/.ssh/id_rsa_<company2name>
  IdentitiesOnly yes
```

3. Clone the git repo using the custom label
```bash
# Before cloning the repo, make a new `repos` folder
cd ~/Documents
mkdir ~/repos
cd repos
# For Azure DevOps use:
git clone company2-devops:v3/<folder>/<folder 2>/<repo>

# For Github use:
git clone git@company2-github.com:geoinformatica-consulting/GeoSplat.git

# If you use the default repo without a configured custom hostname, use:
git clone git@github.com:geoinformatica-consulting/GeoSplat.git


# After you confirm the repo, then change directories into it
cd <repo name>
```

4. Configure your email and user name in Git
```bash
# For Github there is an option to hide your email and use the 'no-reply-email' option. To find this email in Github, go to Settings -> Emails -> change the option "Keep my emails private" or you can disable this option too.
git config --global user.email "<your email>"
git config --global user.name "<your name>"
```

5. Check feature brcatg anches or change to a new one
```bash
git status

# Create and check out a new branch
git checkout -b feature/<new branch name>

# Example: git checkout -b feature/mvd-config-mockup
```
---
---
# Installing Dependencies

You need a linux environment so you need either Node or NVM to manage the versions.

## #1) Update
#### 1. Update your package lists
```sh
sudo apt update
```

#### 2. Install dependencies required for NVM
```sh
sudo apt install -y curl wget build-essential
```

#### 3. Download and run the NVM installation script

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```
#### 4. Close and reopen your terminal, or run this to apply changes immediately:
```sh
export NVM_DIR="$HOME/.nvm"

# This loads nvm
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# This loads nvm bash_completion
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
```

#### 5. Verify NVM installation
```sh
nvm --version
```

#### 6. Check if NVM configuration exists in .bashrc
```sh
grep -i nvm ~/.bashrc
```

> If `NVM` is still not found, add it manually:
> ```sh
>echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
>echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
>echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> >~/.bashrc
>source ~/.bashrc
>```

## #2) Install `node.js` with `nvm`
#### 1. List available Node.js versions
```sh
nvm ls-remote
```
#### 2. Install the latest LTS (Long Term Support) version
```sh
nvm install --lts
```
#### 3. Alternatively, install a specific version (e.g., 18.15.0)
```sh
# nvm install 18.15.0
```

#### 4. Set a version as the default
```sh
nvm alias default lts/*
```

#### 5. Verify Node.js and npm installation
```sh
node --version
npm --version
```

---
---
# Installing & Running the App
- Install `npm` Packages and then Run the `Vite` Program
```sh
npm install
npm run dev
```

# Info

This demo uses two simple `.splat` files shot with a phone using [Scaniverse](https://scaniverse.com/) which are cleaned up up a bit using [supersplat](https://github.com/playcanvas/supersplat) These are far from high quality splats but this doesn't matter for our test.

To be able to show `Three.js` scenes within `CesiumJS` we need to render the `Three.js` code on top of Cesium and sync the `CesiumJS` camera to `Three.js`, this is not ideal because things are not aware of eachother and `Three.js` scenes can be seen through the terrain and other objects placed in CesiumJS such as buildings.

> ## TODOs
> 1. Test using 3D elevation z-aware datatypes to adjust the overlay issue
> 2. Test using CSS z-value to adjust the overlay issue