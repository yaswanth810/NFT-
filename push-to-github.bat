@echo off
echo ============================================================
echo   SCAI NFT Marketplace — Push to GitHub
echo ============================================================
echo.

cd /d "C:\Users\yaswa\.gemini\antigravity\scratch\nft-marketplace"

echo [1/6] Initialising git repository...
git init
if errorlevel 1 goto :error

echo.
echo [2/6] Setting git identity...
git config user.name "yaswanth810"
git config user.email "yaswanthra810@gmail.com"

echo.
echo [3/6] Configuring remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/yaswanth810/NFT-.git

echo.
echo [4/6] Staging all files...
git add .
if errorlevel 1 goto :error

echo.
echo [5/6] Creating initial commit...
git commit -m "feat: SCAI NFT Marketplace - initial release

- Solidity contracts: NFTMarketplace (ERC-721) + Marketplace (escrow)
- Deployed on SCAI Mainnet (Chain ID 34)
- React + Vite + Tailwind CSS frontend
- Pages: Home (live stats), Explore, Mint, My NFTs, NFT Detail
- MetaMask integration with auto network switch to SCAI
- Pinata IPFS uploads for NFT metadata
- Ether Authority branding throughout
- Vercel-ready with vercel.json SPA rewrite rule"
if errorlevel 1 goto :error

echo.
echo [6/6] Pushing to GitHub (branch: main)...
git branch -M main
git push -u origin main
if errorlevel 1 (
    echo.
    echo  NOTE: If push failed with authentication error, GitHub now requires
    echo  a Personal Access Token instead of your password.
    echo.
    echo  Create one at: https://github.com/settings/tokens
    echo  Select scopes: repo (full control)
    echo  Then run: git push -u origin main
    echo  When prompted for password, paste your token.
    goto :done
)

:done
echo.
echo ============================================================
echo   Done! Visit: https://github.com/yaswanth810/NFT-
echo ============================================================
pause
exit /b 0

:error
echo.
echo  ERROR: Something went wrong. See message above.
pause
exit /b 1
