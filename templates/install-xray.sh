set -e
apt-get update -qq && apt-get install -y -qq curl unzip jq > /dev/null 2>&1
if ! command -v xray &> /dev/null; then
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
fi
echo "INSTALL_OK"
