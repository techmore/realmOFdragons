# Dragon Realms Next Gen Evennia Migration

This directory is the new target runtime for the clean-room DragonRealms-inspired MUD.

The existing Node/React implementation remains as a working prototype and regression reference while systems are ported.

## Goal

Build a clean-room, text-first DragonRealms-inspired MUD on Evennia that reaches feature parity with the current prototype, then surpasses it.

Create a playable multi-user MUD where players create accounts, choose canonical DragonRealms-style races, enter Crossing as unaffiliated characters, join guilds in-world, train skills, advance through Circles, explore shops and hunting areas, and fight enemies through asynchronous range-based combat.

## Why Evennia

Evennia directly supports the infrastructure we need:

- Accounts and multiple playable characters.
- Text-first commands, rooms, exits, objects, scripts, sessions, and permissions.
- Telnet and browser webclient support, with browser communication over WebSockets.
- Django persistence and admin tooling.
- Server-side Python systems for progression, combat, shops, NPCs, scripts, and world builders.

Evennia does not provide DragonRealms mechanics out of the box. We still implement races, guilds, skill/circle progression, shops, enemies, and asynchronous range combat as custom game code.

## Local setup

From the repository root:

```sh
python3.13 -m venv .venv-evennia
. .venv-evennia/bin/activate
python -m pip install -r requirements-evennia.txt
cd evennia-game
evennia migrate
evennia start
```

Then connect with:

- Browser: `http://localhost:4001`
- Telnet/MUD client: `localhost:4000`

## Current migration state

Implemented:

- Evennia 5.0.1 project scaffold.
- Game server name set to `Dragon Realms Next Gen`.
- DR data module for races, guilds, skills, skillsets, and guild primary skills.
- Character typeclass initializes race/guild/circle/skill/wallet state.
- Text commands:
  - `score`
  - `skills`
  - `skills armor|weapon|magic|survival|lore|guild`

Next:

1. Override character creation to choose race only and start unaffiliated.
2. Build Crossing rooms/exits from the prototype map.
3. Add guild registrar rooms and `join guild`.
4. Port `train`, `circle`, skill pool/rank progression, and Circle 1-10 smoke tests.
5. Port shops, NPC dialogue, inventory/equipment, and wallets.
6. Port enemies, range/engagement, and asynchronous combat scripts.
