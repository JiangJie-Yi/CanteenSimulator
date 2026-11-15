# 第 176 項最後一步：本機資料夾 JapaneseGrillSimulator 改名為 GrilledFishBusiness（店主選「全部做完後再改」）。
# 這個資料夾在 Claude 的對話、終端分頁開著時會被佔住、改不了名，所以由店主關掉它們之後執行一次：
#   powershell -ExecutionPolicy Bypass -File C:\Users\augus\Projects\JapaneseGrillSimulator\scripts\rename-folder.ps1
# 做的事：停開發伺服器 → 改名（被佔住就多試幾次，還是不行就什麼都不改，開發伺服器重開回原處）→ 文件與設定裡的路徑換新
# → 半夜推送的排程換成新名字與新路徑 → 備忘複製到新資料夾的位置 → 在新資料夾重開開發伺服器 → 測試通過才提交、推上去。
# (Continue: git and npm write their warnings to stderr, which 'Stop' would take for a failure and end on)
$ErrorActionPreference = 'Continue'
$old = 'C:\Users\augus\Projects\JapaneseGrillSimulator'
$new = 'C:\Users\augus\Projects\GrilledFishBusiness'
$utf8 = New-Object System.Text.UTF8Encoding $false
function Say([string]$m) { Write-Host "$(Get-Date -Format 'HH:mm:ss') $m" }
function Swap([string]$path, [string[][]]$pairs) {
  if (-not (Test-Path $path)) { Say "  (沒有 $path)"; return }
  $s = [System.IO.File]::ReadAllText($path, $utf8)
  $was = $s
  foreach ($p in $pairs) { $s = $s.Replace($p[0], $p[1]) }
  if ($s -ne $was) { [System.IO.File]::WriteAllText($path, $s, $utf8); Say "  改了 $path" }
}
Set-Location $env:USERPROFILE
[Environment]::CurrentDirectory = $env:USERPROFILE
if (Test-Path $new) { Say "$new 已經存在，停止"; exit 1 }
if (-not (Test-Path $old)) { Say "找不到 $old，停止"; exit 1 }

# 1. 開發伺服器（舊資料夾的 vite，和啟動它的 npm）
$vite = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$old*vite*" }
foreach ($v in $vite) {
  $p = $v
  while ($p) {
    try { Stop-Process -Id $p.ProcessId -Force; Say "停了開發伺服器 $($p.ProcessId)" } catch { }
    $up = Get-CimInstance Win32_Process -Filter "ProcessId = $($p.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($up -and $up.CommandLine -and $up.CommandLine -like '*run dev*') { $p = $up } else { $p = $null }
  }
}
Start-Sleep -Seconds 2

# 2. 改名（全有或全無）
$moved = $false
for ($k = 1; $k -le 5 -and -not $moved; $k++) {
  try { [System.IO.Directory]::Move($old, $new); $moved = $true; Say "資料夾改名完成：$new" }
  catch { Say "第 $k 次改名失敗：$($_.Exception.Message)"; Start-Sleep -Seconds 3 }
}
if (-not $moved) {
  Say '還是有程式開著這個資料夾（Claude 的對話、終端、VS Code、檔案總管…），關掉後再執行一次。什麼都沒改。'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm.cmd run dev > logs\dev-server.log 2>&1' -WorkingDirectory $old -WindowStyle Hidden
  Say '開發伺服器已在原處重開'
  exit 2
}

# 3. 文件與設定裡的路徑
$wfb = 'GrilledFishBusiness'
Swap "$new\CLAUDE.md" @(, @('Windows 排程工作「JapaneseGrillSimulator nightly push」', "Windows 排程工作「$wfb nightly push」"))
Swap "$new\CLAUDE.md" @(, @('本機（`C:\Users\augus\Projects\JapaneseGrillSimulator`）是主', "本機（``C:\Users\augus\Projects\$wfb``）是主"))
Swap "$new\HANDOFF.md" @(@('C:\Users\augus\Projects\JapaneseGrillSimulator', "C:\Users\augus\Projects\$wfb"), @('..\JapaneseGrillSimulator\', "..\$wfb\"))
Swap "$new\.claude\settings.local.json" @(, @('//c/Users/augus/Projects/JapaneseGrillSimulator/', "//c/Users/augus/Projects/$wfb/"))
Swap "$new\.team\project.json" @(@('"name": "JapaneseGrillSimulator"', "`"name`": `"$wfb`""), @('http://localhost:5174/JapaneseGrillSimulator/', "http://localhost:5174/$wfb/"))
Swap "$new\.team\CHECKLIST.md" @(, @('# JapaneseGrillSimulator 審查清單', "# $wfb 審查清單"))
Swap "$env:USERPROFILE\.claude\team\projects.json" @(, @('{ "name": "JapaneseGrillSimulator", "path": "C:/Users/augus/Projects/JapaneseGrillSimulator"', "{ `"name`": `"$wfb`", `"path`": `"C:/Users/augus/Projects/$wfb`""))
Swap "$env:USERPROFILE\.claude\team\bin\install-task.ps1" @(, @("after JapaneseGrillSimulator's", "after $wfb's"))
# (待辦第 176 列標完成，工作紀錄記一行)
$tp = "$new\TASKS.md"
$t = [System.IO.File]::ReadAllText($tp, $utf8)
$nl = if ($t.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines = $t -split [regex]::Escape($nl)
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i].StartsWith('| 176 |') -and $lines[$i].EndsWith('| 進行中 |')) {
    $lines[$i] = $lines[$i].Substring(0, $lines[$i].Length - '| 進行中 |'.Length).TrimEnd() + "（**完成**：店主關掉對話後執行 scripts\rename-folder.ps1，本機資料夾改名為 $wfb；半夜推送的排程換新名字與新路徑；備忘複製到新位置；設定、Agent Team 登記、CLAUDE.md、HANDOFF.md 的路徑換新） | 完成 |"
  }
}
[System.IO.File]::WriteAllText($tp, ($lines -join $nl), $utf8)
$wp = "$new\WORKLOG.md"
$w = [System.IO.File]::ReadAllText($wp, $utf8).TrimEnd("`r", "`n") + $nl + "- 176 收尾：本機資料夾改名 $wfb（$(Get-Date -Format 'yyyy-MM-dd HH:mm') 由 scripts\rename-folder.ps1 完成：停開發伺服器、改名、路徑換新、排程重建、備忘複製、開發伺服器在新資料夾重開）。" + $nl
[System.IO.File]::WriteAllText($wp, $w, $utf8)

# 4. 半夜推送的排程：同樣的動作、時間、設定、身分，換新資料夾與新名字；舊的刪掉
try {
  $task = Get-ScheduledTask -TaskName 'JapaneseGrillSimulator nightly push' -ErrorAction Stop
  $acts = foreach ($a in $task.Actions) { New-ScheduledTaskAction -Execute $a.Execute -Argument $a.Arguments -WorkingDirectory ($a.WorkingDirectory -replace [regex]::Escape($old), $new) }
  Register-ScheduledTask -TaskName "$wfb nightly push" -Action $acts -Trigger $task.Triggers -Settings $task.Settings -Principal $task.Principal -Description $task.Description -Force -ErrorAction Stop | Out-Null
  Unregister-ScheduledTask -TaskName 'JapaneseGrillSimulator nightly push' -Confirm:$false -ErrorAction Stop
  $n = Get-ScheduledTask -TaskName "$wfb nightly push"
  Say "排程：$($n.TaskName)，起始資料夾 $($n.Actions[0].WorkingDirectory)，下次 $((Get-ScheduledTaskInfo -TaskName $n.TaskName).NextRunTime)"
} catch { Say "排程沒換成：$($_.Exception.Message)" }

# 5. 備忘（Claude Code 依資料夾路徑找）
try {
  $mo = "$env:USERPROFILE\.claude\projects\C--Users-augus-Projects-JapaneseGrillSimulator\memory"
  $mn = "$env:USERPROFILE\.claude\projects\C--Users-augus-Projects-$wfb\memory"
  New-Item -ItemType Directory -Force -Path (Split-Path $mn) -ErrorAction Stop | Out-Null
  Copy-Item -Recurse -Force $mo $mn -ErrorAction Stop
  Say "備忘複製到 $mn（$((Get-ChildItem $mn).Count) 個檔）"
} catch { Say "備忘沒複製成：$($_.Exception.Message)" }

# 6. 開發伺服器在新資料夾
# (in the background, its output to logs\dev-server.log: started in a console window of its own, a paused console (text selected in it)
# stops it writing and the whole server with it: the page stuck at its loading screen, 100%, as the owner saw on 2026-11-15)
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm.cmd run dev > logs\dev-server.log 2>&1' -WorkingDirectory $new -WindowStyle Hidden
$ok = $false
for ($k = 0; $k -lt 20 -and -not $ok; $k++) {
  Start-Sleep -Seconds 2
  try { $ok = (Invoke-WebRequest -Uri "http://localhost:5173/$wfb/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { }
}
Say "開發伺服器（新資料夾）：$(if ($ok) { "http://localhost:5173/$wfb/ 有回應" } else { '還沒回應，稍等再開' })"

# 7. 測試通過才提交、推上去
Set-Location $new
git add CLAUDE.md HANDOFF.md TASKS.md WORKLOG.md 2>&1 | Out-Null
git commit -q -m "docs: item 176 done: the local folder renamed GrilledFishBusiness (scripts/rename-folder.ps1, run by the owner once Claude's session was shut), the nightly push's task and the paths moved with it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" 2>&1 | Out-Null
$test = npm test 2>&1 | Select-String -Pattern 'Tests ' | Select-Object -Last 1
Say "測試：$test"
if ("$test" -match 'failed' -or -not "$test") { Say '測試沒過或沒跑：沒推'; exit 3 }
git fetch origin -q 2>&1 | Out-Null
if ((git rev-list --count main..origin/main) -ne '0') { Say 'GitHub 上有本機沒有的提交：沒推'; exit 4 }
git push origin main 2>&1 | Select-Object -Last 1 | ForEach-Object { Say "推送：$_" }
Say "完成。之後在 Claude 打開 $new 繼續。"
