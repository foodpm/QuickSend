!define PRODUCT_NAME "QuickSend"
!ifndef PRODUCT_VERSION
!define PRODUCT_VERSION "1.0.11"
!endif
!define PRODUCT_PUBLISHER "QuickSend Team"
!define PRODUCT_WEB_SITE "http://www.quicksend.com"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\QuickSend.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; MUI 1.67 compatible ------
!include "MUI.nsh"
!include "WinVer.nsh"
!include "x64.nsh"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "logo.ico"
!define MUI_UNICON "logo.ico"

; Welcome page
!insertmacro MUI_PAGE_WELCOME
; Directory page
!insertmacro MUI_PAGE_DIRECTORY
; Instfiles page
!insertmacro MUI_PAGE_INSTFILES
; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\QuickSend.exe"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_INSTFILES

; Language files
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"

; Reserve files
!insertmacro MUI_RESERVEFILE_INSTALLOPTIONS

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\installer\QuickSend-Setup-${PRODUCT_VERSION}-win64.exe"
InstallDir "$PROGRAMFILES64\QuickSend"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

Function .onInit
  Call IsAtLeastWin81
  Pop $0
  StrCmp $0 "1" +3 0
    MessageBox MB_ICONSTOP "QuickSend ${PRODUCT_VERSION} 不支持 Windows 7/8。请升级到 Windows 8.1/10/11，或使用旧版本。诊断码：QS-WIN7"
    Abort
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "当前系统为 32 位，请下载 win32 安装包。诊断码：QS-ARCH32"
    Abort
  ${EndIf}
FunctionEnd

Function IsAtLeastWin81
  Push $R0
  Push $R1
  Push $R2
  Push $R3

  StrCpy $R0 0

  ClearErrors
  ReadRegDWORD $R1 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentMajorVersionNumber"
  ${IfNot} ${Errors}
    StrCpy $R2 $R1
    StrCpy $R3 0
    Goto _cmp
  ${EndIf}

  ClearErrors
  ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentVersion"
  ${If} ${Errors}
    Goto _done
  ${EndIf}
  StrCpy $R2 $R1 1
  StrCpy $R3 $R1 1 2

  _cmp:
    IntCmp $R2 6 _too_old _check_minor _new_enough
  _check_minor:
    IntCmp $R3 3 _too_old _new_enough _new_enough
  _too_old:
    StrCpy $R0 0
    Goto _done
  _new_enough:
    StrCpy $R0 1

  _done:
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  
  ; Install all files from the build output
  File /r "..\quicksend\quicksend\dist\QuickSend\*.*"
  
  ; Ensure logo.ico is explicitly included
  File "logo.ico"
  
  CreateDirectory "$SMPROGRAMS\QuickSend"
  CreateShortCut "$SMPROGRAMS\QuickSend\QuickSend.lnk" "$INSTDIR\QuickSend.exe" "" "$INSTDIR\logo.ico" 0
  CreateShortCut "$DESKTOP\QuickSend.lnk" "$INSTDIR\QuickSend.exe" "" "$INSTDIR\logo.ico" 0
SectionEnd

Section -AdditionalIcons
  WriteIniStr "$INSTDIR\${PRODUCT_NAME}.url" "InternetShortcut" "URL" "${PRODUCT_WEB_SITE}"
  CreateShortCut "$SMPROGRAMS\QuickSend\Website.lnk" "$INSTDIR\${PRODUCT_NAME}.url"
  CreateShortCut "$SMPROGRAMS\QuickSend\Uninstall.lnk" "$INSTDIR\uninst.exe"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\QuickSend.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\QuickSend.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd

Section Uninstall
  Delete "$INSTDIR\${PRODUCT_NAME}.url"
  Delete "$INSTDIR\uninst.exe"
  Delete "$INSTDIR\QuickSend.exe"
  
  ; Remove everything in the install directory
  RMDir /r "$INSTDIR"

  Delete "$SMPROGRAMS\QuickSend\Uninstall.lnk"
  Delete "$SMPROGRAMS\QuickSend\Website.lnk"
  Delete "$SMPROGRAMS\QuickSend\QuickSend.lnk"
  Delete "$DESKTOP\QuickSend.lnk"
  RMDir "$SMPROGRAMS\QuickSend"

  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  SetAutoClose true
SectionEnd
