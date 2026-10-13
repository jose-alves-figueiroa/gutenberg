#!/bin/bash
# Default electron-builder steps (templates/linux/after-install.tpl, executable "gutenberg" in
# /opt/Gutenberg) followed by the firewall rule for OBS (PLAN.md → US8.2).

if type update-alternatives >/dev/null 2>&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/gutenberg' -a -e '/usr/bin/gutenberg' -a "`readlink '/usr/bin/gutenberg'`" != '/etc/alternatives/gutenberg' ]; then
        rm -f '/usr/bin/gutenberg'
    fi
    update-alternatives --install '/usr/bin/gutenberg' 'gutenberg' '/opt/Gutenberg/gutenberg' 100 || ln -sf '/opt/Gutenberg/gutenberg' '/usr/bin/gutenberg'
else
    ln -sf '/opt/Gutenberg/gutenberg' '/usr/bin/gutenberg'
fi

# Check if user namespaces are supported by the kernel and working with a quick test:
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    # Use SUID chrome-sandbox only on systems without user namespaces:
    chmod 4755 '/opt/Gutenberg/chrome-sandbox' || true
else
    chmod 0755 '/opt/Gutenberg/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Install apparmor profile. (Ubuntu 24+)
# First check if the version of AppArmor running on the device supports our profile.
# This is in order to keep backwards compatibility with Ubuntu 22.04 which does not support abi/4.0.
# In that case, we just skip installing the profile since the app runs fine without it on 22.04.
#
# Those apparmor_parser flags are akin to performing a dry run of loading a profile.
# https://wiki.debian.org/AppArmor/HowToUse#Dumping_profiles
#
# Unfortunately, at the moment AppArmor doesn't have a good story for backwards compatibility.
# https://askubuntu.com/questions/1517272/writing-a-backwards-compatible-apparmor-profile
if apparmor_status --enabled > /dev/null 2>&1; then
  APPARMOR_PROFILE_SOURCE='/opt/Gutenberg/resources/apparmor-profile'
  APPARMOR_PROFILE_TARGET='/etc/apparmor.d/gutenberg'
  if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" > /dev/null 2>&1; then
    cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"

    # Updating the current AppArmor profile is not possible and probably not meaningful in a chroot'ed environment.
    # Use cases are for example environments where images for clients are maintained.
    # There, AppArmor might correctly be installed, but live updating makes no sense.
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      # Extra flags taken from dh_apparmor:
      # > By using '-W -T' we ensure that any abstraction updates are also pulled in.
      # https://wiki.debian.org/AppArmor/Contribute/FirstTimeProfileImport
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET"
    fi
  else
    echo "Skipping the installation of the AppArmor profile as this version of AppArmor does not seem to support the bundled profile"
  fi
fi

# Opens the default Gutenberg port (8484/tcp) when ufw is active, so OBS on the LAN can read the
# overlay. A port changed in Conexão needs: sudo ufw allow <port>/tcp
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 8484/tcp comment 'Gutenberg (OBS)' >/dev/null 2>&1 || true
fi
exit 0
