; ============================================================
; 书库阅读器 - NSIS 安装脚本扩展
; 使用 electron-builder 宏钩子，避免与内置函数冲突
; 功能：安装日志、路径验证、权限检查、错误处理
; ============================================================

!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ---- 安装日志变量 ----
Var LogFile

; ---- 写日志辅助宏 ----
!macro WriteLog Message
  FileOpen $0 $LogFile a
  FileSeek $0 0 END
  FileWrite $0 "${Message}$\r$\n"
  FileClose $0
!macroend

; ---- 初始化（对应 .onInit） ----
!macro customInit
  StrCpy $LogFile "$TEMP\ShuReader_Install.log"
  
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
!macroend

; ---- 安装前操作 ----
!macro customInstall
  !insertmacro WriteLog "[INFO] Starting file extraction..."
  
  ; 检查磁盘空间
  ${DriveSpace} "$INSTDIR" "/D=F /S=M" $1
  !insertmacro WriteLog "[INFO] Available disk space: $1 MB"
  ${If} $1 < 3072
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "磁盘空间不足！$\r$\n$\r$\n剩余空间: $1 MB$\r$\n所需空间: 至少 3072 MB$\r$\n$\r$\n是否继续安装？" IDYES continue_install
    !insertmacro WriteLog "[ERROR] Insufficient disk space, user cancelled"
    Quit
    
    continue_install:
      !insertmacro WriteLog "[WARN] Insufficient disk space, user chose to continue"
  ${EndIf}
!macroend

; ---- 安装后操作 ----
!macro customInstallEnd
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
!macroend

; ---- 卸载初始化 ----
!macro customUnInit
  StrCpy $LogFile "$TEMP\ShuReader_Uninstall.log"
  FileOpen $0 $LogFile w
  FileWrite $0 "==============================================$\r$\n"
  FileWrite $0 "ShuReader Uninstall Log$\r$\n"
  FileWrite $0 "==============================================$\r$\n"
  FileClose $0
!macroend

; ---- 卸载完成 ----
!macro customUnInstall
  !insertmacro WriteLog "[INFO] Uninstallation completed"
  DeleteRegKey HKCU "Software\ShuReader"
!macroend
