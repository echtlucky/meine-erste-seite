; LCKY HUB NSIS Installer Script
; Version 1.0.1

; MUI Settings
!include "MUI2.nsh"

; Product details
Name "LCKY HUB"
Caption "LCKY HUB Installation"
OutFile "LCKY HUB Setup.exe"

; Install directory
InstallDir "$LOCALAPPDATA\LCKY HUB"
InstallDirRegKey HKCU "Software\LCKY HUB" "InstallDir"

; Request application privileges
RequestExecutionLevel user

; Version
VIProductVersion "1.0.1.0"
VIFileVersion "1.0.1.0"

; Add version information to the executable
VIAddVersionKey "ProductName" "LCKY HUB"
VIAddVersionKey "FileDescription" "LCKY HUB - Gaming & Community Platform"
VIAddVersionKey "LegalCopyright" "Copyright © 2024 LCKY HUB Team"
VIAddVersionKey "FileVersion" "1.0.1"

; MUI Icons
!define MUI_ICON "assets\img\logo.ico"
!define MUI_UNICON "assets\img\logo.ico"

; Welcome page
!insertmacro MUI_PAGE_WELCOME

; Directory page
!insertmacro MUI_PAGE_DIRECTORY

; Installation page
!insertmacro MUI_PAGE_INSTFILES

; Finish page
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "German"

; Installer sections
Section "Install" SecMain
    SectionIn RO
    
    ; Set output path to the installation directory
    SetOutPath $INSTDIR
    
    ; Copy all files
    File /r "dist\win\lucky-hub-1.0.1-win32-x64\*.*"
    
    ; Create start menu shortcut
    CreateDirectory "$SMPROGRAMS\LCKY HUB"
    CreateShortCut "$SMPROGRAMS\LCKY HUB\LCKY HUB.lnk" "$INSTDIR\LCKY HUB.exe"
    CreateShortCut "$SMPROGRAMS\LCKY HUB\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    
    ; Create desktop shortcut
    CreateShortCut "$DESKTOP\LCKY HUB.lnk" "$INSTDIR\LCKY HUB.exe"
    
    ; Add uninstall information to registry
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "DisplayName" "LCKY HUB"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "DisplayIcon" "$INSTDIR\resources\app.ico"
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "VersionMajor" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "VersionMinor" 0
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "NoRepair" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB" "EstimatedSize" 80000
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Show success message
    SetShellVarContext all
    MessageBox MB_OK "LCKY HUB wurde erfolgreich installiert!$\n$\nDu kannst die App jetzt über den Desktop-Shortcut oder das Startmenü öffnen."

SectionEnd

; Uninstaller section
Section "Uninstall"

    ; Remove shortcuts
    Delete "$DESKTOP\LCKY HUB.lnk"
    Delete "$SMPROGRAMS\LCKY HUB\LCKY HUB.lnk"
    Delete "$SMPROGRAMS\LCKY HUB\Uninstall.lnk"
    RMDir "$SMPROGRAMS\LCKY HUB"
    
    ; Remove installation directory
    Delete "$INSTDIR\*.*"
    RMDir "$INSTDIR"
    
    ; Remove registry keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LCKY HUB"
    DeleteRegKey HKCU "Software\LCKY HUB"

SectionEnd
