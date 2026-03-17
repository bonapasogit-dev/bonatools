@echo off
SET ORG_BASE_SSH=git@github.com:<your-organization>
SET REPO_NAME=%1

REM Check if the repository name argument was provided
if "%REPO_NAME%" == "" (
    echo Error: Please provide a repository name as an argument.
    echo Usage: clone.bat repository-name
    goto :end
)

SET CLONE_URL=%ORG_BASE_SSH%/%REPO_NAME%.git

echo Attempting to clone %REPO_NAME% from %ORG_BASE_SSH%
echo Running command: git clone %CLONE_URL%

git clone %CLONE_URL%

REM Check the exit status of the previous command (git clone)
if %ERRORLEVEL% equ 0 (
    echo.
    echo Success: Repository '%REPO_NAME%' cloned into the current directory.
) else (
    echo.
    echo Failure: Git clone failed. Check your SSH keys and permissions.
)

:end
