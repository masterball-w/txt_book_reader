; ============================================================
; 书库阅读器 - NSIS 安装脚本扩展
; 功能：安装日志、路径验证、权限检查、错误处理
; ============================================================

!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ---- 安装日志变量 ----
Var LogFile

; ---- 写日志辅助函数 ----
!macro WriteLog Message
  FileOpen $0 $LogFile a
  FileSeek $0 0 END
  FileWrite $0 "${Message}$\r$\n"
  FileClose $0
!macroend

; ---- 安装初始化 ----
Function .onInit
  ; 初始化安装日志
  StrCpy $LogFile "$TEMP\ShuReader_Install.log"
  
  ; 创建/覆盖日志文件
  FileOpen $0 $LogFile w
  FileWrite $0 "==============================================$\r$\n"
  FileWrite $0 "ShuReader Install Log$\r$\n"
  FileWrite $0 "Version: 1.0.0$\r$\n"
  FileWrite $0 "==============================================$\r$\n"
  FileClose $0
  
  ; 检查管理员权限
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 == "Admin"
    !insertmacro WriteLog "[INFO] User has admin privileges"
  ${Else}
    !insertmacro WriteLog "[WARN] User does not have admin privileges"
  ${EndIf}
  
  ; 检查是否已安装旧版本
  ReadRegStr $2 HKCU "Software\ShuReader" "InstallPath"
  ${If} $2 != ""
    !insertmacro WriteLog "[INFO] Previous installation found at: $2"
  ${Else}
    !insertmacro WriteLog "[INFO] First installation"
  ${EndIf}
FunctionEnd

; ---- 安装目录验证 ----
Function .onVerifyInstDir
  ; 检查写入权限
  ClearErrors
  FileOpen $0 "$INSTDIR\__shureader_test.tmp" w
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "安装路径无写入权限：$\r$\n$INSTDIR$\r$\n$\r$\n请选择其他安装路径或以管理员身份运行安装程序。"
    !insertmacro WriteLog "[ERROR] No write permission: $INSTDIR"
    Abort
  ${EndIf}
  FileClose $0
  Delete "$INSTDIR\__shureader_test.tmp"
  !insertmacro WriteLog "[INFO] Install path verified: $INSTDIR"
FunctionEnd

; ---- 安装前操作 ----
Section -PreInstall
  !insertmacro WriteLog "[INFO] Starting file extraction..."
  
  ; 检查磁盘空间是否足够（至少需要 3GB）
  ${DriveSpace} "$INSTDIR" "/D=F /S=M" $1
  !insertmacro WriteLog "[INFO] Available disk space: $1 MB"
  ${If} $1 < 3072
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "磁盘空间不足！$\r$\n$\r$\n剩余空间: $1 MB$\r$\n所需空间: 至少 3072 MB$\r$\n$\r$\n是否继续安装？" IDYES continue_install
    !insertmacro WriteLog "[ERROR] Insufficient disk space, user cancelled"
    Quit
    
    continue_install:
      !insertmacro WriteLog "[WARN] Insufficient disk space, user chose to continue"
  ${EndIf}
SectionEnd

; ---- 安装后操作 ----
Section -PostInstall
  !insertmacro WriteLog "[INFO] File extraction completed"
  
  ; 验证关键文件
  IfFileExists "$INSTDIR\书库阅读器.exe" verify_main verify_fail
  verify_main:
    !insertmacro WriteLog "[INFO] Main executable verified"
    Goto verify_resources
    
  verify_fail:
    !insertmacro WriteLog "[ERROR] Main executable missing!"
    MessageBox MB_OK|MB_ICONSTOP "安装文件不完整！$\r$\n$\r$\n主程序文件缺失，请重新下载安装包。"
    Abort
    
  verify_resources:
    IfFileExists "$INSTDIR\resources\shu\cn\books.json" verify_ok verify_books_fail
    verify_ok:
      !insertmacro WriteLog "[INFO] Book resources verified"
      Goto verify_done
      
    verify_books_fail:
      !insertmacro WriteLog "[WARN] Book resources incomplete"
      MessageBox MB_OK|MB_ICONEXCLAMATION "书库资源文件可能不完整。$\r$\n$\r$\n您可以继续使用程序，但可能无法阅读部分书籍。"
      
  verify_done:
    ; 记录安装路径到注册表
    WriteRegStr HKCU "Software\ShuReader" "InstallPath" "$INSTDIR"
    WriteRegStr HKCU "Software\ShuReader" "Version" "1.0.0"
    !insertmacro WriteLog "[INFO] Installation completed at: $INSTDIR"
    
    ; 复制日志到安装目录
    CopyFiles "$LogFile" "$INSTDIR\install.log"
SectionEnd

; ---- 卸载初始化 ----
Function un.onInit
  StrCpy $LogFile "$TEMP\ShuReader_Uninstall.log"
  FileOpen $0 $LogFile w
  FileWrite $0 "==============================================$\r$\n"
  FileWrite $0 "ShuReader Uninstall Log$\r$\n"
  FileWrite $0 "==============================================$\r$\n"
  FileClose $0
FunctionEnd

; ---- 卸载完成 ----
Section -UnPostUninstall
  !insertmacro WriteLog "[INFO] Uninstallation completed"
  DeleteRegKey HKCU "Software\ShuReader"
SectionEnd
