& {
    $ErrorActionPreference = 'Stop'

    $version = if ($env:FASTAPI_STARTKIT_VERSION) { $env:FASTAPI_STARTKIT_VERSION } else { 'latest' }
    $windows = $env:OS -eq 'Windows_NT'
    $binary = if ($windows) { 'uv.exe' } else { 'uv' }

    function Find-Uv {
        $command = Get-Command uv -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) {
            return $command.Source
        }
        $directories = @($env:UV_INSTALL_DIR, $env:XDG_BIN_HOME, (Join-Path $HOME '.local/bin'), (Join-Path $HOME '.cargo/bin'))
        foreach ($directory in $directories) {
            if ($directory -and (Test-Path -LiteralPath (Join-Path $directory $binary) -PathType Leaf)) {
                return (Join-Path $directory $binary)
            }
        }
        return $null
    }

    $uv = Find-Uv
    if (-not $uv) {
        if (-not $windows) {
            throw 'fastapi-startkit: on macOS and Linux use https://fastapi-startkit.github.io/install.sh'
        }
        Write-Host 'Installing uv...'
        & ([scriptblock]::Create((Invoke-RestMethod https://astral.sh/uv/install.ps1)))
        $uv = Find-Uv
        if (-not $uv) {
            throw 'fastapi-startkit: uv was installed but could not be found; open a new terminal and run: uvx fastapi-startkit@latest init'
        }
    }

    $env:PATH = (Split-Path -Parent $uv) + [System.IO.Path]::PathSeparator + $env:PATH

    & $uv tool run "fastapi-startkit@$version" init @args
    $global:LASTEXITCODE = $LASTEXITCODE
} @args
