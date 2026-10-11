"""
AHG License Manager - Discord Bot
Controls the license storage via GitHub Gist
"""

import asyncio
import json
import time
import traceback

import discord
from aiohttp import web  # ships with discord.py
from discord.ext import commands
import requests
import os
import re

# Load bot/.env (KEY=VALUE lines) without extra dependencies; real env vars win.
BOT_DIR = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(BOT_DIR, ".env")
if os.path.exists(_env_path):
    with open(_env_path, encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

# Configuration
DISCORD_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# Startup validation
if not DISCORD_TOKEN or not GITHUB_TOKEN:
    print("ERROR: DISCORD_BOT_TOKEN and GITHUB_TOKEN env vars must be set")
    exit(1)

# Gist IDs are not in source: anyone with a secret gist's ID can read every key in it.
GIST_ID = os.environ.get("LICENSE_GIST_ID", "")
UNIVERSAL_GIST_ID = os.environ.get("UNIVERSAL_GIST_ID", "")
LICENSE_API_PORT = int(os.environ.get("LICENSE_API_PORT", "8765"))
# No domain needed: the bot runs a free Cloudflare quick tunnel and publishes its
# (changing) https URL to this public gist; the app reads the URL from there.
ENDPOINT_GIST_ID = os.environ.get("ENDPOINT_GIST_ID", "")
CLOUDFLARED = os.environ.get("CLOUDFLARED", r"C:\Program Files (x86)\cloudflared\cloudflared.exe")
# OAuth secret + share channel live here, not in the desktop app.
DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "1491071254206353580")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
SHARE_CHANNEL_ID = int(os.environ.get("SHARE_CHANNEL_ID", "1502571428757635092"))
OAUTH_REDIRECT_URI = os.environ.get("OAUTH_REDIRECT_URI", "http://localhost:18765/callback")
if not GIST_ID:
    print("ERROR: LICENSE_GIST_ID env var must be set")
    exit(1)
UNIVERSAL_ROLE_ID = 1503872186430259372
DOWNLOAD_CHANNEL_ID = 1504144492314497024
OWNER_ROLE_ID = 1491191565966639185
STAFF_ROLE_ID = 1491237678325174292
ADMIN_USER_IDS = [622023586135408641]
CUSTOMER_ROLE_ID = 1491191878845202452
SETUP_GUIDE_CHANNEL_ID = 1491170307971616798
FEEDBACK_CHANNEL_ID = 1491243635264585908
GUILD_ID = 1251277120999784559

# Colors for embeds
GREEN = 0x34d399
RED = 0xf87171
BLUE = 0x60a5fa
YELLOW = 0xfbbf24

# Media source tracking
MEDIA_STATS_FILE = os.path.join(BOT_DIR, "media_stats.json")
STATS_CHANNEL_ID = 1500522964704169994

def load_media_stats():
    if os.path.exists(MEDIA_STATS_FILE):
        with open(MEDIA_STATS_FILE, 'r') as f:
            data = json.load(f)
            if "voters" not in data:
                data["voters"] = {}
            return data
    return {"instagram": 0, "youtube": 0, "tiktok": 0, "from_a_friend": 0, "total": 0, "voters": {}}

def save_media_stats(stats):
    with open(MEDIA_STATS_FILE, 'w') as f:
        json.dump(stats, f, indent=2)

class WhereFromView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Instagram", emoji="📸", style=discord.ButtonStyle.primary, custom_id="wherefrom_instagram")
    async def instagram_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_choice(interaction, "instagram", "📸 Instagram")

    @discord.ui.button(label="Youtube", emoji="🎬", style=discord.ButtonStyle.danger, custom_id="wherefrom_youtube")
    async def youtube_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_choice(interaction, "youtube", "🎬 Youtube")

    @discord.ui.button(label="Tiktok", emoji="🎵", style=discord.ButtonStyle.success, custom_id="wherefrom_tiktok")
    async def tiktok_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_choice(interaction, "tiktok", "🎵 Tiktok")

    @discord.ui.button(label="From a friend", emoji="🤝", style=discord.ButtonStyle.secondary, custom_id="wherefrom_friend")
    async def friend_callback(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_choice(interaction, "from_a_friend", "🤝 From a friend")

    async def handle_choice(self, interaction: discord.Interaction, key: str, display: str):
        user_id = str(interaction.user.id)
        stats = load_media_stats()

        if "voters" not in stats:
            stats["voters"] = {}

        if user_id in stats["voters"]:
            old_key = stats["voters"][user_id]
            if old_key == key:
                await interaction.response.send_message(
                    embed=discord.Embed(
                        title="⏳ **Already voted**",
                        description=f"You already selected **{display}**",
                        color=YELLOW
                    ),
                    ephemeral=True
                )
                return

        if user_id not in stats["voters"]:
            stats[key] = stats.get(key, 0) + 1
            stats["total"] = stats.get("total", 0) + 1

        stats["voters"][user_id] = key
        save_media_stats(stats)

        channel = interaction.client.get_channel(STATS_CHANNEL_ID)
        if channel:
            embed = discord.Embed(
                title="📊 **New WhereFrom Response**",
                color=GREEN,
                timestamp=interaction.created_at
            )
            embed.add_field(name="👤 **User**", value=interaction.user.mention, inline=True)
            embed.add_field(name="📱 **Platform**", value=display, inline=True)
            embed.set_footer(text=f"Total responses: {stats['total']}")
            await channel.send(embed=embed)

        await interaction.response.send_message(
            embed=discord.Embed(
                title="✅ **Thanks for your response!**",
                description=f"You selected: **{display}**",
                color=GREEN
            ),
            ephemeral=True
        )

def chunk_lines(lines, limit=3800):
    """Group lines into embed-description-sized pages (Discord caps these at 4096)."""
    pages, current = [], ""
    for line in lines:
        if len(current) + len(line) + 1 > limit:
            pages.append(current)
            current = ""
        current += line + "\n"
    pages.append(current or "No licenses found.")
    return pages


async def get_gist(gist_id=None):
    """Fetch licenses from GitHub Gist asynchronously"""
    if gist_id is None:
        gist_id = GIST_ID
    try:
        url = f"https://api.github.com/gists/{gist_id}"
        resp = await asyncio.to_thread(
            lambda: requests.get(url, headers={
                "Authorization": f"token {GITHUB_TOKEN}",
                "Accept": "application/vnd.github.v3+json"
            }, timeout=15)
        )

        print(f"Gist fetch status: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            content = data.get("files", {}).get("license_keys.json", {}).get("content", "{}")
            licenses = json.loads(content) if content else {}
            print(f"Loaded {len(licenses)} licenses from Gist")
            return licenses
        elif resp.status_code == 404:
            print("ERROR: Gist not found!")
            return None
        else:
            print(f"ERROR: Gist fetch failed with status {resp.status_code}")
            return None
    except Exception as e:
        print(f"ERROR fetching Gist: {e}")
        traceback.print_exc()
        return None

async def update_gist(licenses, retries=3, delay=2, gist_id=None):
    """Update licenses in GitHub Gist asynchronously with retry logic"""
    if gist_id is None:
        gist_id = GIST_ID
    url = f"https://api.github.com/gists/{gist_id}"
    content = json.dumps(licenses, indent=2)
    payload = {
        "description": "AHG License Keys",
        "files": {
            "license_keys.json": {
                "content": content
            }
        }
    }

    for attempt in range(retries):
        try:
            resp = await asyncio.to_thread(
                lambda: requests.patch(url, headers={
                    "Authorization": f"token {GITHUB_TOKEN}",
                    "Accept": "application/vnd.github.v3+json",
                    "Content-Type": "application/json",
                    "User-Agent": "AHG-License-Bot"
                }, json=payload, timeout=30)
            )

            print(f"Gist update status: {resp.status_code}")

            if resp.status_code == 200:
                print("Successfully updated Gist")
                return True
            elif resp.status_code == 403:
                print("Rate limited. Waiting 60s...")
                await asyncio.sleep(60)
                continue
            else:
                print(f"ERROR: Gist update failed with status {resp.status_code}")
                print(f"Response: {resp.text[:500]}")
                return False

        except Exception as e:
            print(f"ERROR updating Gist (attempt {attempt+1}/{retries}): {e}")
            if attempt < retries - 1:
                print(f"Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay *= 2
            else:
                traceback.print_exc()
                return False

    return False

intents = discord.Intents.default()
intents.message_content = True
# Required for guild.members / get_member. Without it `guild.members` only ever
# contains the bot itself, so /notifyrole silently reported "No members found".
# The privileged intent is already enabled for this application in the dev portal.
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)
tree = bot.tree

async def check_staff(interaction):
    """Check if user is admin or staff, send error if not"""
    try:
        if not interaction.user:
            return False
        if interaction.user.id in ADMIN_USER_IDS:
            return True
        for role in interaction.user.roles:
            if role.id in (OWNER_ROLE_ID, STAFF_ROLE_ID):
                return True
    except Exception as e:
        print(f"ERROR in check_staff: {e}")
        traceback.print_exc()
        if not interaction.response.is_done():
            embed = discord.Embed(title="❌ Error", description="Permission check failed.", color=RED)
            await interaction.response.send_message(embed=embed, ephemeral=True)
        return False

    embed = discord.Embed(title="❌ Access Denied", description="You don't have permission to use this command.", color=RED)
    if not interaction.response.is_done():
        await interaction.response.send_message(embed=embed, ephemeral=True)
    return False

GUILD_OBJ = discord.Object(id=GUILD_ID) if GUILD_ID else None

_views_registered = False


@bot.event
async def on_ready():
    global _views_registered
    print(f"Logged in as {bot.user}")
    print("Syncing commands...")

    # on_ready fires again on every gateway reconnect, so this is guarded — otherwise
    # the persistent view is re-registered on each reconnect for the lifetime of the process.
    if not _views_registered:
        bot.add_view(WhereFromView())
        _views_registered = True
        print("Registered WhereFromView as persistent")

    try:
        if GUILD_ID:
            await tree.sync(guild=GUILD_OBJ)
            print(f"Commands synced to guild {GUILD_ID}")
        else:
            # Only meaningful when commands are NOT guild-scoped. Every command here is
            # registered with guild=GUILD_OBJ, so a global sync pushed an empty set while
            # printing "synced globally" — a misleading log plus a rate-limited call per start.
            await tree.sync()
            print("Commands synced globally (may take time to propagate)")
    except Exception as e:
        print(f"Sync error: {e}")
        traceback.print_exc()

    print("Registered commands:")
    cmds = tree.get_commands(guild=GUILD_OBJ) if GUILD_ID else tree.get_commands()
    for cmd in cmds:
        print(f"  - /{cmd.name}")

# ── Slash Commands ──────────────────────────────────────────────────────────

@tree.command(guild=GUILD_OBJ, name="store", description="Get purchase link")
async def buy(interaction):
    try:
        embed = discord.Embed(
            title="🛒 **AHG Steam Unlocker Store** 🛒",
            color=GREEN,
            description="🎮 **Want to unlock Steam games?**\n\nGet your license now and start playing!"
        )
        embed.add_field(name="🌐 **Purchase Here**", value="**[👉 Click Here 👈](https://ahgscript-store.mysellauth.com/)**", inline=False)
        embed.add_field(name="📋 **How to Buy**", value="```\n1️⃣  Visit the store link above\n2️⃣  Select your preferred plan\n3️⃣  Complete the payment\n4️⃣  Join our Discord for activation\n```", inline=False)
        embed.add_field(name="💡 **Need Help?**", value="Open a ticket in our Discord server!", inline=False)
        embed.set_footer(text="AHG Script | Premium Steam Unlocking")
        await interaction.response.send_message(embed=embed)
    except Exception as e:
        print(f"Error in buy: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="storegift", description="Purchase info via Binance USDT Gift Card")
async def storegift(interaction):
    try:
        embed = discord.Embed(
            title="💳 **Payment Method Update** 💳",
            color=BLUE,
            description="We currently accept **only Binance USDT Gift Cards** due to a temporary issue with our website payment methods."
        )
        embed.add_field(
            name="🎟️ **Purchase Here**",
            value="[👉 20$ USDT Gift Card — G2A](https://www.g2a.com/binance-gift-card-20-usdt-key-i10000301475012?suid=7578b0a9-9ccf-418f-9ed6-e23b8255fe70)",
            inline=False
        )
        embed.add_field(
            name="📝 **How to Purchase & Activate**",
            value=(
                "```\n"
                "1️⃣  Purchase a 20$ USDT Gift Card from the link above\n"
                "2️⃣  Open a ticket and paste the redeem key\n"
                "3️⃣  That's it! Your license will be activated and you'll receive your product 🎉\n"
                "```"
            ),
            inline=False
        )
        embed.add_field(name="⏱️ **Note**", value="Please be patient while waiting for the owner to verify your key.", inline=False)
        embed.set_footer(text="AHG Script | Premium Steam Unlocking")
        await interaction.response.send_message(embed=embed)
    except Exception as e:
        print(f"Error in storegift: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="wherefrom", description="Tell us where you heard about AHG Script")
async def wherefrom(interaction):
    try:
        embed = discord.Embed(
            title="📢 **Where did you hear about AHG Script?**",
            description="We'd love to know how you found us! Click one of the buttons below:",
            color=BLUE
        )
        embed.set_footer(text="AHG Script | Your feedback helps us grow! 🚀")
        view = WhereFromView()
        await interaction.response.send_message(embed=embed, view=view)
    except Exception as e:
        print(f"Error in wherefrom: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="mediastats", description="View media source statistics")
async def mediastats(interaction):
    if not await check_staff(interaction):
        return
    try:
        stats = load_media_stats()
        total = stats.get("total", 0)
        insta = stats.get("instagram", 0)
        yt = stats.get("youtube", 0)
        tt = stats.get("tiktok", 0)
        friend = stats.get("from_a_friend", 0)

        embed = discord.Embed(
            title="📊 **Media Source Statistics**",
            description="Where users heard about AHG Script:" if total > 0 else "No responses collected yet.",
            color=GREEN
        )

        if total > 0:
            embed.add_field(name="📸 **Instagram**", value=f"**{insta}** ({insta/total*100:.0f}%)", inline=True)
            embed.add_field(name="🎬 **Youtube**", value=f"**{yt}** ({yt/total*100:.0f}%)", inline=True)
            embed.add_field(name="🎵 **Tiktok**", value=f"**{tt}** ({tt/total*100:.0f}%)", inline=True)
            embed.add_field(name="🤝 **From a friend**", value=f"**{friend}** ({friend/total*100:.0f}%)", inline=True)
            embed.add_field(name="📊 **Total**", value=f"**{total}** responses", inline=False)

        embed.set_footer(text="AHG Script | Media Analytics")
        await interaction.response.send_message(embed=embed)
    except Exception as e:
        print(f"Error in mediastats: {e}")
        traceback.print_exc()
        if not interaction.response.is_done():
            embed = discord.Embed(title="❌ **Error**", description="An unexpected error occurred.", color=RED)
            await interaction.response.send_message(embed=embed, ephemeral=True)

@tree.command(guild=GUILD_OBJ, name="activate", description="Add a new license (pending)")
async def add(interaction, license_key: str):
    license_key = license_key.strip().removeprefix("<@").removeprefix("!").removesuffix(">")  # accept @mentions
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist. Please try again later.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        if license_key in licenses and licenses[license_key] != "pending":
            embed = discord.Embed(title="⚠️ **Already Activated**", description="This license is already activated!", color=YELLOW)
            embed.add_field(name="ℹ️ **Info**", value="The license key is already in use.", inline=False)
            await interaction.followup.send(embed=embed)
            return

        licenses[license_key] = "pending"

        if await update_gist(licenses):
            try:
                member = await interaction.guild.fetch_member(int(license_key))
            except (discord.NotFound, ValueError):
                member = None
            except discord.Forbidden:
                print("WARNING: Bot lacks members intent - cannot fetch member")
                member = None

            embed = discord.Embed(
                title="✅ **License Activated!**",
                color=GREEN,
                description=f"🎉 **Welcome!** License has been activated for <@{license_key}>"
            )

            role_assigned = False
            if member:
                role = interaction.guild.get_role(CUSTOMER_ROLE_ID)
                if role:
                    try:
                        await member.add_roles(role, reason="License activation")
                        role_assigned = True
                    except discord.Forbidden:
                        print(f"WARNING: Missing permissions to assign customer role to {license_key}")
                        embed.add_field(name="⚠️ **Role Error**", value="Could not assign customer role - check bot permissions.", inline=False)
                    except discord.HTTPException as e:
                        print(f"WARNING: HTTP error assigning role to {license_key}: {e}")
                        embed.add_field(name="⚠️ **Role Error**", value=f"Failed to assign role: {e}", inline=False)
            else:
                embed.add_field(name="⚠️ **User Not Found**", value="Could not find this user in the server. Make sure the ID is correct and they have joined.", inline=False)

            if role_assigned:
                embed.add_field(name="🎭 **Role**", value="✅ Customer role assigned!", inline=False)
            embed.add_field(name="📖 **Next Steps**", value="Follow the setup guide below and enjoy unlocking games!", inline=False)
            embed.add_field(name="🔗 **Setup Guide**", value=f"<#{SETUP_GUIDE_CHANNEL_ID}>", inline=False)
            embed.add_field(name="💬 **Feedback**", value=f"A review in <#{FEEDBACK_CHANNEL_ID}> would help us a lot! ❤️", inline=False)
            embed.set_footer(text="AHG Script | Thank you for your purchase! 🎮")
            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(title="❌ **Update Failed**", description="Failed to update Gist. Please try again.", color=RED)
            await interaction.followup.send(embed=embed)
    except Exception as e:
        print(f"Error in add: {e}")
        traceback.print_exc()
        try:
            embed = discord.Embed(title="❌ **Error**", description="An unexpected error occurred.", color=RED)
            await interaction.followup.send(embed=embed)
        except:
            pass

@tree.command(guild=GUILD_OBJ, name="activateuniversal", description="Add a license to the universal gist")
async def add_universal(interaction, license_key: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist(gist_id=UNIVERSAL_GIST_ID)

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to universal Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        if license_key in licenses and licenses[license_key] != "pending":
            embed = discord.Embed(title="⚠️ **Already Activated**", description="This license is already active in the universal gist!", color=YELLOW)
            await interaction.followup.send(embed=embed)
            return

        licenses[license_key] = "pending"

        if await update_gist(licenses, gist_id=UNIVERSAL_GIST_ID):
            try:
                member = await interaction.guild.fetch_member(int(license_key))
            except (discord.NotFound, ValueError):
                member = None
            except discord.Forbidden:
                print("WARNING: Bot lacks members intent - cannot fetch member")
                member = None

            embed = discord.Embed(
                title="✅ **License Added to Universal Gist!**",
                color=GREEN,
                description=f"🎉 **Welcome!** License has been activated for <@{license_key}>"
            )

            role_assigned = False
            if member:
                role = interaction.guild.get_role(UNIVERSAL_ROLE_ID)
                if role:
                    try:
                        await member.add_roles(role, reason="Universal license activation")
                        role_assigned = True
                    except discord.Forbidden:
                        print(f"WARNING: Missing permissions to assign universal role to {license_key}")
                        embed.add_field(name="⚠️ **Role Error**", value="Could not assign universal role - check bot permissions.", inline=False)
                    except discord.HTTPException as e:
                        print(f"WARNING: HTTP error assigning role to {license_key}: {e}")
                        embed.add_field(name="⚠️ **Role Error**", value=f"Failed to assign role: {e}", inline=False)
            else:
                embed.add_field(name="⚠️ **User Not Found**", value="Could not find this user in the server. Make sure the ID is correct and they have joined.", inline=False)

            if role_assigned:
                embed.add_field(name="🎭 **Role**", value="✅ Universal converter role assigned!", inline=False)
            embed.add_field(name="📋 **Status**", value="⏳ Pending activation", inline=False)
            embed.add_field(name="📥 **Download**", value=f"<#{DOWNLOAD_CHANNEL_ID}>", inline=False)
            embed.add_field(name="💬 **Feedback**", value=f"A review in <#{FEEDBACK_CHANNEL_ID}> would help us a lot! ❤️", inline=False)
            embed.set_footer(text="AHG Script | Universal License Manager")
            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(title="❌ **Update Failed**", description="Failed to update universal Gist.", color=RED)
            await interaction.followup.send(embed=embed)
    except Exception as e:
        print(f"Error in add_universal: {e}")
        traceback.print_exc()
        try:
            embed = discord.Embed(title="❌ **Error**", description="An unexpected error occurred.", color=RED)
            await interaction.followup.send(embed=embed)
        except:
            pass

@tree.command(guild=GUILD_OBJ, name="removeuniversal", description="Remove a license from the universal gist")
async def remove_universal(interaction, license_key: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist(gist_id=UNIVERSAL_GIST_ID)

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to universal Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        if license_key not in licenses:
            embed = discord.Embed(title="❌ **License Not Found**", description=f"License `{license_key}` is not in the universal gist", color=YELLOW)
            embed.add_field(name="ℹ️ **Tip**", value="Use `/listuniversal` to see all universal licenses.", inline=False)
            await interaction.followup.send(embed=embed)
            return

        del licenses[license_key]

        if await update_gist(licenses, gist_id=UNIVERSAL_GIST_ID):
            try:
                member = await interaction.guild.fetch_member(int(license_key))
            except (discord.NotFound, ValueError):
                member = None
            except discord.Forbidden:
                print("WARNING: Bot lacks members intent - cannot fetch member")
                member = None

            embed = discord.Embed(title="🗑️ **License Removed from Universal Gist**", color=GREEN, description="✅ Successfully removed license from the universal gist")
            embed.add_field(name="📋 **Removed Key**", value=f"```{license_key}```", inline=False)

            if member:
                role = interaction.guild.get_role(UNIVERSAL_ROLE_ID)
                if role:
                    try:
                        await member.remove_roles(role, reason="Universal license removal")
                        embed.add_field(name="🎭 **Role**", value="✅ Universal converter role removed!", inline=False)
                    except discord.Forbidden:
                        print(f"WARNING: Missing permissions to remove universal role from {license_key}")
                        embed.add_field(name="⚠️ **Role Error**", value="Could not remove universal role - check bot permissions.", inline=False)
                    except discord.HTTPException as e:
                        print(f"WARNING: HTTP error removing role from {license_key}: {e}")
                        embed.add_field(name="⚠️ **Role Error**", value=f"Failed to remove role: {e}", inline=False)
            else:
                embed.add_field(name="⚠️ **User Not Found**", value="License removed from gist but user was not found in the server.", inline=False)

            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(title="❌ **Update Failed**", description="Failed to update universal Gist.", color=RED)
            await interaction.followup.send(embed=embed)
    except Exception as e:
        print(f"Error in remove_universal: {e}")
        traceback.print_exc()
        try:
            embed = discord.Embed(title="❌ **Error**", description="An unexpected error occurred.", color=RED)
            await interaction.followup.send(embed=embed)
        except:
            pass

@tree.command(guild=GUILD_OBJ, name="refreshuniversal", description="Reset a universal license for reactivation")
async def refresh_universal(interaction, license_key: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist(gist_id=UNIVERSAL_GIST_ID)

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to universal Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        if license_key not in licenses:
            embed = discord.Embed(title="⚠️ **License Not Found**", description=f"License `{license_key}` is not in the universal gist.", color=YELLOW)
            embed.add_field(name="🆔 **License Key**", value=f"```{license_key}```", inline=False)
            embed.add_field(name="💡 **Solution**", value="Use `/activateuniversal` to add it first.", inline=False)
            await interaction.followup.send(embed=embed)
            return

        old_status = licenses.get(license_key, "N/A")
        licenses[license_key] = "pending"

        if not await update_gist(licenses, gist_id=UNIVERSAL_GIST_ID):
            embed = discord.Embed(title="❌ **Update Failed**", description="Could not update the universal Gist. Please try again.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        try:
            member = await interaction.guild.fetch_member(int(license_key))
        except (discord.NotFound, ValueError):
            member = None
        except discord.Forbidden:
            print("WARNING: Bot lacks members intent - cannot fetch member")
            member = None

        embed = discord.Embed(title="🔄 **Universal License Refreshed**", color=GREEN, description=f"✅ License `{license_key}` has been reset to pending!")
        embed.add_field(name="📋 **Previous Status**", value=f"```{old_status[:20]}```" if len(str(old_status)) > 20 else f"```{old_status}```", inline=True)
        embed.add_field(name="📋 **New Status**", value="🔄 **Pending reactivation**", inline=True)

        if member:
            embed.set_thumbnail(url=member.display_avatar.url)
            embed.add_field(name="👤 **User**", value=member.mention, inline=False)

        embed.add_field(name="📝 **Next Steps**", value="User must run `/activateuniversal` again to reactivate.", inline=False)
        embed.set_footer(text="AHG Script | Universal License Manager")
        await interaction.followup.send(embed=embed)

        try:
            if member:
                dm_embed = discord.Embed(title="🔄 **Universal License Refreshed**", color=GREEN, description="Your universal license has been refreshed by an admin!")
                dm_embed.add_field(name="📝 **What to do**", value="Contact staff to have your universal license reactivated.", inline=False)
                dm_embed.set_footer(text="AHG Script | Universal License Manager")
                await member.send(embed=dm_embed)
        except:
            pass

    except Exception as e:
        print(f"Error in refresh_universal: {e}")
        traceback.print_exc()
        embed = discord.Embed(title="❌ **Error**", description=f"An error occurred: {str(e)}", color=RED)
        await interaction.followup.send(embed=embed)

@tree.command(guild=GUILD_OBJ, name="remove", description="Remove a license")
async def remove(interaction, license_key: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        if license_key not in licenses:
            embed = discord.Embed(title="❌ **License Not Found**", description=f"License `{license_key}` is not in the license list", color=YELLOW)
            embed.add_field(name="ℹ️ **Tip**", value="Use `/list` to see all active licenses.", inline=False)
            await interaction.followup.send(embed=embed)
            return

        del licenses[license_key]

        if await update_gist(licenses):
            embed = discord.Embed(title="🗑️ **License Removed**", color=GREEN, description="✅ Successfully removed license from the list")
            embed.add_field(name="📋 **Removed Key**", value=f"```{license_key}```", inline=False)
            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(title="❌ **Update Failed**", description="Failed to update Gist.", color=RED)
            await interaction.followup.send(embed=embed)
    except Exception as e:
        print(f"Error in remove: {e}")
        traceback.print_exc()
        try:
            embed = discord.Embed(title="❌ **Error**", description="An unexpected error occurred.", color=RED)
            await interaction.followup.send(embed=embed)
        except:
            pass

@tree.command(guild=GUILD_OBJ, name="list", description="List all licenses")
async def list_cmd(interaction):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        if not licenses:
            embed = discord.Embed(title="📋 **License List**", description="No licenses found.", color=GREEN)
            await interaction.followup.send(embed=embed)
            return

        active = sum(1 for v in licenses.values() if v != "pending")
        pending = sum(1 for v in licenses.values() if v == "pending")

        # One embed field per license used to blow past Discord's 25-field /
        # 6000-char ceiling, so /list returned HTTP 400 as soon as the registry
        # grew past ~25 keys. Licenses now go in the description, paginated.
        lines = [
            f"{'⏳' if status == 'pending' else '✅'} `{did}`"
            for did, status in licenses.items()
        ]
        pages = chunk_lines(lines)

        for i, page in enumerate(pages):
            embed = discord.Embed(
                title="📋 **License List**" + (f" ({i + 1}/{len(pages)})" if len(pages) > 1 else ""),
                color=GREEN,
                description=page,
            )
            if i == 0:
                embed.add_field(
                    name="📈 **Statistics**",
                    value=f"```\n✅ Active: {active}\n⏳ Pending: {pending}\nTotal: {len(licenses)}\n```",
                    inline=False,
                )
            await interaction.followup.send(embed=embed)
    except Exception as e:
        print(f"Error in list: {e}")
        traceback.print_exc()
        try:
            embed = discord.Embed(title="❌ **Error**", description="An error occurred.", color=RED)
            await interaction.followup.send(embed=embed)
        except:
            pass

@tree.command(guild=GUILD_OBJ, name="check", description="Check license status")
async def check(interaction, license_key: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        if license_key not in licenses:
            embed = discord.Embed(title="❌ **License Not Found**", description=f"License `{license_key}` is not in the list", color=YELLOW)
            embed.add_field(name="🔍 **Search Tip**", value="Use `/list` to see all active licenses.", inline=False)
            await interaction.followup.send(embed=embed)
            return

        status = licenses[license_key]

        if status == "pending":
            embed = discord.Embed(title="🔍 **License Status**", color=YELLOW, description="⏳ **Pending Activation**")
            embed.add_field(name="🎫 **License Key**", value=f"```{license_key}```", inline=False)
            embed.add_field(name="📊 **Status**", value="```\n⏳ Waiting for first activation\n```", inline=False)
        else:
            embed = discord.Embed(title="🔍 **License Status**", color=GREEN, description="✅ **Activated & Ready**")
            embed.add_field(name="🎫 **License Key**", value=f"```{license_key}```", inline=False)
            embed.add_field(name="📊 **Status**", value="```\n✅ Active and working\n```", inline=False)

        await interaction.followup.send(embed=embed)
    except Exception as e:
        print(f"Error in check: {e}")
        traceback.print_exc()
        try:
            embed = discord.Embed(title="❌ **Error**", description="An error occurred.", color=RED)
            await interaction.followup.send(embed=embed)
        except:
            pass

@tree.command(guild=GUILD_OBJ, name="notifyall", description="Send a DM to all license holders")
async def notifyall(interaction, message: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        guild = interaction.guild

        sent = 0
        failed = 0
        not_found = []

        for user_id in licenses.keys():
            # `clean_id` was assigned inside the try but referenced in the except,
            # so any failure before that line raised NameError and hid the real error.
            clean_id = user_id.strip().replace("<@", "").replace(">", "").replace("!", "")
            try:
                user = guild.get_member(int(clean_id))
                if not user:
                    user = await guild.fetch_member(int(clean_id))

                if user:
                    dm_embed = discord.Embed(title="📢 **AHG Steam Unlocker**", color=GREEN, description=message)
                    dm_embed.set_footer(text="Sent by AHG Team 💪")
                    await user.send(embed=dm_embed)
                    sent += 1
                else:
                    failed += 1
                    not_found.append(clean_id)
            except Exception as e:
                failed += 1
                not_found.append(clean_id)
                print(f"Failed to DM {user_id}: {e}")

        embed = discord.Embed(title="📢 **Broadcast Complete**", color=GREEN, description="✅ Your message has been sent to all users")
        embed.add_field(name="📤 **Sent**", value=f"**{sent}** users", inline=True)
        embed.add_field(name="❌ **Failed**", value=f"**{failed}** users", inline=True)

        if not_found:
            embed.add_field(name="⚠️ **Not Found**", value=f"```\n{', '.join(not_found[:5])}```", inline=False)

        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in notifyall: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="stats", description="View license statistics")
async def stats(interaction):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        total = len(licenses)
        active = sum(1 for v in licenses.values() if v != "pending")
        pending = sum(1 for v in licenses.values() if v == "pending")

        embed = discord.Embed(title="📊 **License Statistics**", color=GREEN, description="📈 **Overview of AHG Steam Unlocker Licenses**")
        embed.add_field(name="📦 **Total**", value=f"**{total}**", inline=True)
        embed.add_field(name="✅ **Active**", value=f"**{active}**", inline=True)
        embed.add_field(name="⏳ **Pending**", value=f"**{pending}**", inline=True)
        embed.add_field(name="📋 **Details**", value=f"```\nActive Licenses: {active}\nPending Licenses: {pending}\nTotal Licenses: {total}\n```", inline=False)
        embed.set_footer(text="AHG Script | License Manager")

        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in stats: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="refresh", description="Remove and reactivate a user's license")
async def refresh(interaction, user: discord.Member):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        user_id = str(user.id)

        if user_id not in licenses:
            embed = discord.Embed(title="⚠️ **License Not Found**", description=f"**{user.name}** doesn't have a license in the system.", color=YELLOW)
            embed.set_thumbnail(url=user.display_avatar.url)
            embed.add_field(name="🆔 **User ID**", value=f"```{user_id}```", inline=False)
            embed.add_field(name="💡 **Solution**", value="User needs to activate their license first.", inline=False)
            await interaction.followup.send(embed=embed)
            return

        old_machine = licenses.get(user_id, "N/A")
        licenses[user_id] = "pending"

        if not await update_gist(licenses):
            embed = discord.Embed(title="❌ **Update Failed**", description="Could not update the Gist. Please try again.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        embed = discord.Embed(title="🔄 **License Refreshed**", color=GREEN, description=f"✅ **{user.name}**'s license has been reset!")
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.add_field(name="🆔 **User**", value=f"```{user.name}```", inline=True)
        embed.add_field(name="📋 **Status**", value="🔄 **Ready for reactivation**", inline=True)
        embed.add_field(name="💾 **Previous Machine**", value=f"```{old_machine[:16]}...```" if len(old_machine) > 16 else f"```{old_machine}```", inline=False)
        embed.add_field(name="📝 **Next Steps**", value="User must open the app and reactivate with their license key.", inline=False)
        embed.set_footer(text="AHG Steam Unlocker 💫")

        await interaction.followup.send(embed=embed)

        try:
            dm_embed = discord.Embed(title="🔄 **License Refreshed**", color=GREEN, description="Your license has been refreshed by an admin!")
            dm_embed.add_field(name="📝 **What to do**", value="Simply open the AHG Steam Unlocker app and enter your license key again to reactivate.", inline=False)
            dm_embed.set_footer(text="AHG Steam Unlocker 💫")
            await user.send(embed=dm_embed)
        except:
            pass

    except Exception as e:
        print(f"Error in refresh: {e}")
        traceback.print_exc()
        embed = discord.Embed(title="❌ **Error**", description=f"An error occurred: {str(e)}", color=RED)
        await interaction.followup.send(embed=embed)

@tree.command(guild=GUILD_OBJ, name="refreshall", description="Reset all licenses - all users must reactivate")
async def refreshall_confirm(interaction, confirm: str = None):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()

        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        total = len(licenses)
        active_before = sum(1 for v in licenses.values() if v != "pending")

        # Guard was inverted: with no argument `confirm` is None, so `confirm and ...`
        # was False and the command fell straight through to resetting every license.
        # The bare, most likely invocation was the destructive one.
        if not confirm or confirm.lower() != "confirm":
            embed = discord.Embed(title="⚠️ **Confirm Refresh All**", color=YELLOW, description=f"You're about to reset **{total}** licenses!\n\nAll users will need to reactivate their licenses. This cannot be undone!")
            embed.add_field(name="✅ **To confirm**", value="Run `/refreshall confirm`", inline=False)
            await interaction.followup.send(embed=embed)
            return

        for key in licenses.keys():
            licenses[key] = "pending"

        if not await update_gist(licenses):
            embed = discord.Embed(title="❌ **Update Failed**", description="Could not update the Gist. Please try again.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        embed = discord.Embed(title="🔄 **All Licenses Refreshed**", color=GREEN, description=f"✅ Successfully reset **{total}** licenses!")
        embed.add_field(name="📊 **Before**", value=f"✅ **{active_before}** active", inline=True)
        embed.add_field(name="📊 **After**", value="🔄 **All pending**", inline=True)
        embed.add_field(name="📝 **Next Steps**", value="All users must reactivate using their license keys.", inline=False)
        embed.set_footer(text="AHG Steam Unlocker 💫")

        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in refreshall: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="notify", description="Send a DM to a specific user")
async def notify(interaction, user: discord.Member, message: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()

        try:
            dm_embed = discord.Embed(title="📢 **AHG Steam Unlocker**", color=GREEN, description=message)
            dm_embed.set_footer(text="Sent by AHG Team 💪")
            await user.send(embed=dm_embed)

            embed = discord.Embed(title="✅ **Message Sent**", color=GREEN, description=f"Message successfully sent to **{user.name}**")
            embed.set_thumbnail(url=user.display_avatar.url)
            embed.add_field(name="👤 **Recipient**", value=f"```{user.name}```", inline=True)
            embed.add_field(name="📝 **Message**", value=f"```{message[:100]}...```" if len(message) > 100 else f"```{message}```", inline=False)
            embed.set_footer(text="AHG Steam Unlocker 💫")

            await interaction.followup.send(embed=embed)

        except discord.Forbidden:
            embed = discord.Embed(title="⚠️ **DM Failed**", color=YELLOW, description=f"Could not send DM to **{user.name}** - they may have DMs disabled.")
            embed.set_thumbnail(url=user.display_avatar.url)
            await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in notify: {e}")
        traceback.print_exc()
        embed = discord.Embed(title="❌ **Error**", description=f"An error occurred: {str(e)}", color=RED)
        await interaction.followup.send(embed=embed)

@tree.command(guild=GUILD_OBJ, name="notifyrole", description="DM all members with a specific role")
async def notifycustomers(interaction, role: discord.Role, message: str):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()

        members = [m for m in interaction.guild.members if role in m.roles and not m.bot]

        if not members:
            embed = discord.Embed(title="⚠️ **No Members Found**", description=f"No members with role {role.mention}", color=YELLOW)
            await interaction.followup.send(embed=embed)
            return

        sent = 0
        failed = 0

        for member in members:
            try:
                dm_embed = discord.Embed(title="📢 **AHG Steam Unlocker**", color=GREEN, description=message)
                dm_embed.set_footer(text="Sent by AHG Team 💪")
                await member.send(embed=dm_embed)
                sent += 1
            except discord.Forbidden:
                failed += 1
            except Exception as e:
                failed += 1
                print(f"Failed to DM {member.id}: {e}")

        embed = discord.Embed(
            title="📢 **Role Broadcast Complete**",
            color=GREEN,
            description=f"Message sent to members with {role.mention}"
        )
        embed.add_field(name="🎯 **Role**", value=role.mention, inline=True)
        embed.add_field(name="📤 **Sent**", value=f"**{sent}**", inline=True)
        embed.add_field(name="❌ **Failed**", value=f"**{failed}**", inline=True)
        embed.add_field(name="📝 **Message**", value=f"```{message[:200]}```" if len(message) > 200 else f"```{message}```", inline=False)
        embed.set_footer(text="AHG Steam Unlocker 💫")

        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in notifycustomers: {e}")
        traceback.print_exc()
        embed = discord.Embed(title="❌ **Error**", description=f"An error occurred: {str(e)}", color=RED)
        await interaction.followup.send(embed=embed)

@tree.command(guild=GUILD_OBJ, name="info", description="Check a user's license status")
async def info(interaction, user: discord.Member):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        user_id = str(user.id)

        found = False
        for lic_key, status in licenses.items():
            if lic_key == user_id:
                found = True
                is_pending = status == "pending"

                embed = discord.Embed(title="👤 **User Info**", color=GREEN if not is_pending else YELLOW, description=f"**{user.name}** ({user.mention})")
                embed.set_thumbnail(url=user.display_avatar.url)
                embed.add_field(name="🆔 **User ID**", value=f"```{user_id}```", inline=True)
                embed.add_field(name="📛 **Nickname**", value=f"```{user.nick or 'None'}```", inline=True)

                if is_pending:
                    embed.add_field(name="📋 **License**", value="⏳ **Pending** - Not activated", inline=False)
                else:
                    embed.add_field(name="📋 **License**", value="✅ **Active** - Licensed", inline=False)

                roles = [role.mention for role in user.roles if role.name != "@everyone"]
                if roles:
                    embed.add_field(name="🎭 **Roles**", value=" ".join(roles[:5]), inline=False)

                break

        if not found:
            embed = discord.Embed(title="👤 **User Info**", color=RED, description=f"**{user.name}** ({user.mention})")
            embed.set_thumbnail(url=user.display_avatar.url)
            embed.add_field(name="User ID", value=f"`{user_id}`", inline=True)
            embed.add_field(name="License", value="Not Found - No license", inline=False)

        embed.set_footer(text="AHG License Manager")
        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in info: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="kick", description="Kick a user and remove their license")
async def kick(interaction, user: discord.Member, reason: str = None):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()
        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist — no action taken.", color=RED)
            await interaction.followup.send(embed=embed)
            return
        user_id = str(user.id)

        removed = licenses.pop(user_id, None) is not None
        if removed:
            await update_gist(licenses)

        try:
            await user.kick(reason=reason or "License removed by admin")
            embed = discord.Embed(title="👢 **User Kicked**", color=RED, description=f"🚪 **{user.name}** has been removed from the server")
            embed.add_field(name="📋 **License**", value="🗑️ License removed from system", inline=False)
            if reason:
                embed.add_field(name="📝 **Reason**", value=f"```\n{reason}\n```", inline=False)
            embed.set_footer(text="AHG Script | Action performed by admin")
        except Exception as e:
            embed = discord.Embed(title="⚠️ **Partial Success**", color=YELLOW, description="License was removed but user could not be kicked")
            print(f"Kick error: {e}")

        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in kick: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="ban", description="Ban a user and remove their license")
async def ban(interaction, user: discord.Member, reason: str = None):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()
        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist — no action taken.", color=RED)
            await interaction.followup.send(embed=embed)
            return
        user_id = str(user.id)

        removed = licenses.pop(user_id, None) is not None
        if removed:
            await update_gist(licenses)

        try:
            await user.ban(reason=reason or "License revoked by admin", delete_message_days=0)
            embed = discord.Embed(title="🔨 **User Banned**", color=RED, description=f"⛔ **{user.name}** has been permanently banned")
            embed.add_field(name="📋 **License**", value="🚫 License revoked from system", inline=False)
            if reason:
                embed.add_field(name="📝 **Reason**", value=f"```\n{reason}\n```", inline=False)
            embed.set_footer(text="AHG Script | Permanent action taken by admin")
        except Exception as e:
            embed = discord.Embed(title="⚠️ **Partial Success**", color=YELLOW, description="License was revoked but user could not be banned")
            print(f"Ban error: {e}")

        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in ban: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="export", description="Export all licenses to a file")
async def export(interaction):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        content = "# AHG Steam Unlocker - License Export\n"
        content += f"# Generated: {discord.utils.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
        for lic_key, status in licenses.items():
            content += f"{lic_key}: {status}\n"

        from io import BytesIO
        file = discord.File(BytesIO(content.encode()), filename="licenses_export.txt")

        embed = discord.Embed(title="📤 **Licenses Exported**", color=GREEN, description=f"✅ Successfully exported **{len(licenses)}** licenses")
        embed.add_field(name="📄 **File**", value="```licenses_export.txt```", inline=False)
        await interaction.followup.send(embed=embed, file=file)

    except Exception as e:
        print(f"Error in export: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="clear", description="Clear all pending licenses")
async def clear(interaction):
    if not await check_staff(interaction):
        return
    try:
        await interaction.response.defer()
        licenses = await get_gist()

        if licenses is None:
            embed = discord.Embed(title="❌ **Connection Error**", description="Could not connect to Gist.", color=RED)
            await interaction.followup.send(embed=embed)
            return

        pending = [k for k, v in licenses.items() if v == "pending"]

        for key in pending:
            del licenses[key]

        if pending:
            await update_gist(licenses)

        embed = discord.Embed(title="🧹 **Pending Licenses Cleared**", color=GREEN, description=f"✅ Successfully removed **{len(pending)}** pending licenses")
        embed.add_field(name="📋 **Summary**", value=f"```\nRemoved: {len(pending)} pending\n```", inline=False)
        await interaction.followup.send(embed=embed)

    except Exception as e:
        print(f"Error in clear: {e}")
        traceback.print_exc()

@tree.command(guild=GUILD_OBJ, name="help", description="Show all available commands")
async def help(interaction):
    try:
        embed = discord.Embed(title="📚 **AHG License Manager**", color=GREEN, description="🎮 **Welcome to AHG Script!**\nHere are all available commands:")

        embed.add_field(name="🌐 **Public Commands**", value="━━━━━━━━━━━━━━━━━━", inline=False)
        embed.add_field(name="🛒 `/store`", value="Get the store link to purchase a license", inline=False)
        embed.add_field(name="💳 `/storegift`", value="Purchase info via Binance USDT Gift Card", inline=False)
        embed.add_field(name="📢 `/wherefrom`", value="Tell us where you heard about AHG Script", inline=False)
        embed.add_field(name="📖 `/help`", value="Show this help message", inline=False)

        embed.add_field(name="🔒 **Owner Commands**", value="━━━━━━━━━━━━━━━━━━", inline=False)
        embed.add_field(name="➕ `/activate`", value="Add a new license to the system", inline=False)
        embed.add_field(name="➕ `/activateuniversal`", value="Add a license to the universal gist", inline=False)
        embed.add_field(name="➖ `/removeuniversal`", value="Remove a license from the universal gist", inline=False)
        embed.add_field(name="🔄 `/refreshuniversal`", value="Reset a universal license for reactivation", inline=False)
        embed.add_field(name="➖ `/remove`", value="Remove a license from the list", inline=False)
        embed.add_field(name="📋 `/list`", value="List all licenses in the system", inline=False)
        embed.add_field(name="🔍 `/check`", value="Check a specific license status", inline=False)
        embed.add_field(name="📢 `/notifyall`", value="Send a message to all license holders", inline=False)
        embed.add_field(name="📢 `/notify`", value="Send a message to a specific user", inline=False)
        embed.add_field(name="📢 `/notifyrole`", value="DM all members with a specific role", inline=False)
        embed.add_field(name="🔄 `/refresh`", value="Reset a user's license for reactivation", inline=False)
        embed.add_field(name="🔄 `/refreshall`", value="Reset ALL licenses - everyone must reactivate", inline=False)
        embed.add_field(name="📊 `/stats`", value="View license statistics", inline=False)
        embed.add_field(name="📊 `/mediastats`", value="View media source statistics", inline=False)
        embed.add_field(name="👤 `/info`", value="Check a user's license status", inline=False)
        embed.add_field(name="👢 `/kick`", value="Kick a user and remove their license", inline=False)
        embed.add_field(name="🔨 `/ban`", value="Ban a user and revoke their license", inline=False)
        embed.add_field(name="📤 `/export`", value="Export all licenses to a file", inline=False)
        embed.add_field(name="🧹 `/clear`", value="Clear all pending licenses", inline=False)

        embed.set_footer(text="AHG Script | Premium Steam Unlocking 🔒 = Owner only")
        await interaction.response.send_message(embed=embed)

    except Exception as e:
        print(f"Error in help: {e}")
        traceback.print_exc()

@bot.event
async def on_command_error(ctx, error):
    # People type '!' things constantly in a public server; without this, every
    # unmatched one dumps a CommandNotFound traceback into the log.
    if isinstance(error, commands.CommandNotFound):
        return
    print(f"Command error in {ctx.command}: {error}")
    traceback.print_exc()


@bot.event
async def on_message(message):
    if message.author.bot:
        return

    if not message.content.startswith('!'):
        return

    parts = message.content.split()
    command = parts[0].lower()

    if command == '!help':
        await message.reply("**Commands:**\n`!add <key>` - Add license\n`!remove <key>` - Remove\n`!list` - List all\n`!check <key>` - Check status\n\nOr use slash commands: `/add`, `/remove`, `/list`, `/check`")
        return

    if command == '!add':
        if len(parts) < 2:
            await message.reply("Usage: `!add <license_key>`")
            return
        licenses = await get_gist()
        if licenses is None:
            await message.reply("Error: Could not connect to Gist")
            return
        if parts[1] in licenses:
            await message.reply(f"License `{parts[1]}` already exists")
            return
        licenses[parts[1]] = "pending"
        if await update_gist(licenses):
            await message.reply(f"✅ Added `{parts[1]}`")
        else:
            await message.reply("Error: Failed to update Gist")
        return

    if command == '!remove':
        if len(parts) < 2:
            await message.reply("Usage: `!remove <license_key>`")
            return
        licenses = await get_gist()
        if licenses is None:
            await message.reply("Error: Could not connect to Gist")
            return
        if parts[1] not in licenses:
            await message.reply(f"License `{parts[1]}` not found")
            return
        del licenses[parts[1]]
        if await update_gist(licenses):
            await message.reply(f"✅ Removed `{parts[1]}`")
        else:
            await message.reply("Error: Failed to update Gist")
        return

    if command == '!list':
        licenses = await get_gist()
        if licenses is None:
            await message.reply("Error: Could not connect to Gist")
            return
        if not licenses:
            await message.reply("No licenses")
            return
        msg = "**License List:**\n"
        for did, status in licenses.items():
            s = "⏳ Pending" if status == "pending" else "✅ Active"
            msg += f"`{did}` - {s}\n"
        await message.reply(msg)
        return

    if command == '!check':
        if len(parts) < 2:
            await message.reply("Usage: `!check <license_key>`")
            return
        licenses = await get_gist()
        if licenses is None:
            await message.reply("Error: Could not connect to Gist")
            return
        if parts[1] not in licenses:
            await message.reply(f"ID `{parts[1]}` not found")
            return
        status = licenses[parts[1]]
        s = "⏳ Pending" if status == "pending" else "✅ Active"
        await message.reply(f"**Status:** {s}")
        return

    # Overriding on_message suppresses discord.py's built-in command dispatch. Nothing
    # uses @bot.command() today, so this changes no behaviour — it just means a prefix
    # command added later actually fires instead of silently doing nothing. Reached only
    # by '!' messages that none of the manual handlers above claimed.
    await bot.process_commands(message)

# ── License HTTP API (desktop app talks to this; the app holds no GitHub token) ──
# Serve behind an HTTPS reverse proxy; the app refuses non-https URLs when packaged.
_license_lock = asyncio.Lock()
_rate_hits = {}


def _rate_ok(ip, limit=20, window=60):
    now = time.time()
    hits = [t for t in _rate_hits.get(ip, []) if now - t < window]
    hits.append(now)
    _rate_hits[ip] = hits
    if len(_rate_hits) > 10000:  # ponytail: crude cap, swap for a TTL cache if traffic grows
        _rate_hits.clear()
    return len(hits) <= limit


async def _license_body(request):
    ip = request.headers.get("X-Forwarded-For", request.remote or "?").split(",")[0].strip()
    if not _rate_ok(ip):
        raise web.HTTPTooManyRequests()
    try:
        body = await request.json()
    except Exception:
        raise web.HTTPBadRequest()
    key = str(body.get("key", "")).strip().upper()
    machine_id = str(body.get("machineId", "")).strip()
    if not key or len(key) > 64 or not machine_id or len(machine_id) > 128:
        raise web.HTTPBadRequest()
    return key, machine_id


def _license_status(licenses, key, machine_id):
    value = licenses.get(key)
    if value is None:
        return "missing"
    if value in ("used", "pending"):
        return value
    return "bound" if value == machine_id else "other"


async def api_license_check(request):
    key, machine_id = await _license_body(request)
    licenses = await get_gist()
    if licenses is None:
        raise web.HTTPServiceUnavailable()
    return web.json_response({"status": _license_status(licenses, key, machine_id)})


async def api_license_activate(request):
    key, machine_id = await _license_body(request)
    async with _license_lock:  # serialise read-modify-write of the gist
        licenses = await get_gist()
        if licenses is None:
            raise web.HTTPServiceUnavailable()
        status = _license_status(licenses, key, machine_id)
        if status == "pending":
            licenses[key] = machine_id
            if not await update_gist(licenses):
                raise web.HTTPServiceUnavailable()
            status = "bound"
    return web.json_response({"status": status})


async def _json_body(request):
    ip = request.headers.get("X-Forwarded-For", request.remote or "?").split(",")[0].strip()
    if not _rate_ok(ip):
        raise web.HTTPTooManyRequests()
    try:
        body = await request.json()
    except Exception:
        raise web.HTTPBadRequest()
    if not isinstance(body, dict):
        raise web.HTTPBadRequest()
    return body


def _discord_post(path, data):
    return requests.post(f"https://discord.com/api/v10{path}", data=data, timeout=15)


async def api_discord_token(request):
    """OAuth code/refresh exchange — the client secret never leaves the bot."""
    body = await _json_body(request)
    grant = body.get("grant_type")
    data = {"client_id": DISCORD_CLIENT_ID, "client_secret": DISCORD_CLIENT_SECRET, "grant_type": grant}
    if grant == "authorization_code" and isinstance(body.get("code"), str) and len(body["code"]) < 200:
        data.update(code=body["code"], redirect_uri=OAUTH_REDIRECT_URI)
    elif grant == "refresh_token" and isinstance(body.get("refresh_token"), str) and len(body["refresh_token"]) < 200:
        data.update(refresh_token=body["refresh_token"])
    else:
        raise web.HTTPBadRequest()
    resp = await asyncio.to_thread(_discord_post, "/oauth2/token", data)
    return web.json_response(resp.json() if resp.ok else {"error": resp.status_code}, status=resp.status_code)


async def api_discord_revoke(request):
    body = await _json_body(request)
    token = body.get("token")
    if isinstance(token, str) and len(token) < 200:
        await asyncio.to_thread(_discord_post, "/oauth2/token/revoke",
                                {"client_id": DISCORD_CLIENT_ID, "client_secret": DISCORD_CLIENT_SECRET, "token": token})
    return web.json_response({"ok": True})


async def api_discord_share(request):
    """Post a 'game added' embed. Caller proves who they are with their OAuth token."""
    body = await _json_body(request)
    token, appid, name = body.get("accessToken"), str(body.get("appid", "")), str(body.get("gameName", ""))[:200]
    cover = str(body.get("coverUrl") or "")
    if not isinstance(token, str) or not appid.isdigit() or not name:
        raise web.HTTPBadRequest()
    me = await asyncio.to_thread(lambda: requests.get(
        "https://discord.com/api/v10/users/@me", headers={"Authorization": f"Bearer {token}"}, timeout=15))
    if not me.ok:
        raise web.HTTPUnauthorized()
    user = me.json()
    who = user.get("global_name") or user.get("username") or "A user"
    try:
        dlc_count = max(0, int(body.get("dlcCount") or 0))
    except (TypeError, ValueError):
        dlc_count = 0
    embed = discord.Embed(title=f"U0001F389 {name}", url=f"https://steamdb.info/app/{appid}/", color=0x8B5CF6,
                          description=f"✅ **{who}** added this game to **AHG Steam Unlocker**")
    embed.add_field(name="U0001F4CB App ID", value=appid, inline=True)
    embed.add_field(name="U0001F464 Added by", value=who, inline=True)
    if dlc_count:
        embed.add_field(name="U0001F3AE DLCs", value=f"{dlc_count} unlocked", inline=True)
    # Only Steam CDN images — no arbitrary URLs in the bot's posts.
    if cover.startswith("https://") and any(h in cover.split("/")[2] for h in ("steamstatic.com", "steampowered.com")):
        embed.set_image(url=cover)
    channel = bot.get_channel(SHARE_CHANNEL_ID) or await bot.fetch_channel(SHARE_CHANNEL_ID)
    await channel.send(embed=embed)
    return web.json_response({"ok": True})


async def start_license_api():
    api = web.Application(client_max_size=4096)
    api.router.add_post("/license/check", api_license_check)
    api.router.add_post("/license/activate", api_license_activate)
    api.router.add_post("/discord/token", api_discord_token)
    api.router.add_post("/discord/revoke", api_discord_revoke)
    api.router.add_post("/discord/share", api_discord_share)
    runner = web.AppRunner(api)
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", LICENSE_API_PORT).start()
    print(f"License API listening on :{LICENSE_API_PORT}")
    if ENDPOINT_GIST_ID:
        global _tunnel_task
        _tunnel_task = asyncio.create_task(run_quick_tunnel())


_tunnel_task = None


def _publish_endpoint(url):
    return requests.patch(
        f"https://api.github.com/gists/{ENDPOINT_GIST_ID}",
        headers={"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"},
        json={"files": {"endpoint.json": {"content": json.dumps({"url": url})}}},
        timeout=30,
    )


async def run_quick_tunnel():
    """Keep a Cloudflare quick tunnel up and publish its current URL to the endpoint gist."""
    while True:
        try:
            proc = await asyncio.create_subprocess_exec(
                CLOUDFLARED, "tunnel", "--no-autoupdate", "--url", f"http://localhost:{LICENSE_API_PORT}",
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
            async for line in proc.stderr:  # keep draining so the pipe never blocks cloudflared
                m = re.search(rb"https://[a-z0-9-]+\.trycloudflare\.com", line)
                if m:
                    url = m.group().decode()
                    resp = await asyncio.to_thread(_publish_endpoint, url)
                    print(f"Tunnel up: {url} (endpoint gist update: HTTP {resp.status_code})")
            await proc.wait()
            print("Tunnel exited — restarting in 5s")
        except Exception as e:
            print(f"Tunnel error: {e} — retrying in 5s")
        await asyncio.sleep(5)


bot.setup_hook = start_license_api

bot.run(DISCORD_TOKEN)
