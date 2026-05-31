"""
Command sets

All commands in the game must be grouped in a cmdset.  A given command
can be part of any number of cmdsets and cmdsets can be added/removed
and merged onto entities at runtime.

To create new commands to populate the cmdset, see
`commands/command.py`.

This module wraps the default command sets of Evennia; overloads them
to add/remove commands from the default lineup. You can create your
own cmdsets by inheriting from them or directly from `evennia.CmdSet`.

"""

from evennia import default_cmds

from commands.dr_commands import CmdDRAccountCharacters, CmdDRAccountCreateCharacter, CmdDRAccountHelp, CmdDRAdvance, CmdDRAppraise, CmdDRAttributes, CmdDRBash, CmdDRBuildCrossing, CmdDRBuy, CmdDRCircle, CmdDRCombat, CmdDRCreateCharacter, CmdDRDefend, CmdDREquipment, CmdDRFlee, CmdDRForage, CmdDRGet, CmdDRGuildAbilities, CmdDRGuildBoon, CmdDRGuildFocus, CmdDRGuildPerks, CmdDRGuildPractice, CmdDRGuildTechnique, CmdDRHands, CmdDRHealth, CmdDRHelp, CmdDRInventory, CmdDRJab, CmdDRJoinGuild, CmdDRLoot, CmdDRRace, CmdDRRange, CmdDRRegistrar, CmdDRRerollAttributes, CmdDRRespawn, CmdDRRetreat, CmdDRRevive, CmdDRRoom, CmdDRScan, CmdDRScore, CmdDRSell, CmdDRShop, CmdDRSkills, CmdDRSkin, CmdDRStance, CmdDRTarget, CmdDRTend, CmdDRTrain, CmdDRUse, CmdDRWait, CmdDRWear, CmdDRWield


class CharacterCmdSet(default_cmds.CharacterCmdSet):
    """
    The `CharacterCmdSet` contains general in-game commands like `look`,
    `get`, etc available on in-game Character objects. It is merged with
    the `AccountCmdSet` when an Account puppets a Character.
    """

    key = "DefaultCharacter"

    def at_cmdset_creation(self):
        """
        Populates the cmdset
        """
        super().at_cmdset_creation()
        self.add(CmdDRAdvance())
        self.add(CmdDRAppraise())
        self.add(CmdDRAttributes())
        self.add(CmdDRBash())
        self.add(CmdDRBuildCrossing())
        self.add(CmdDRBuy())
        self.add(CmdDRCircle())
        self.add(CmdDRCombat())
        self.add(CmdDRCreateCharacter())
        self.add(CmdDRDefend())
        self.add(CmdDREquipment())
        self.add(CmdDRFlee())
        self.add(CmdDRForage())
        self.add(CmdDRGet())
        self.add(CmdDRGuildAbilities())
        self.add(CmdDRGuildBoon())
        self.add(CmdDRGuildFocus())
        self.add(CmdDRGuildPerks())
        self.add(CmdDRGuildPractice())
        self.add(CmdDRGuildTechnique())
        self.add(CmdDRHands())
        self.add(CmdDRHealth())
        self.add(CmdDRHelp())
        self.add(CmdDRInventory())
        self.add(CmdDRJab())
        self.add(CmdDRJoinGuild())
        self.add(CmdDRLoot())
        self.add(CmdDRRace())
        self.add(CmdDRRange())
        self.add(CmdDRRegistrar())
        self.add(CmdDRRerollAttributes())
        self.add(CmdDRRespawn())
        self.add(CmdDRRetreat())
        self.add(CmdDRRevive())
        self.add(CmdDRRoom())
        self.add(CmdDRScan())
        self.add(CmdDRScore())
        self.add(CmdDRSell())
        self.add(CmdDRShop())
        self.add(CmdDRSkills())
        self.add(CmdDRSkin())
        self.add(CmdDRStance())
        self.add(CmdDRTarget())
        self.add(CmdDRTend())
        self.add(CmdDRTrain())
        self.add(CmdDRUse())
        self.add(CmdDRWait())
        self.add(CmdDRWear())
        self.add(CmdDRWield())


class AccountCmdSet(default_cmds.AccountCmdSet):
    """
    This is the cmdset available to the Account at all times. It is
    combined with the `CharacterCmdSet` when the Account puppets a
    Character. It holds game-account-specific commands, channel
    commands, etc.
    """

    key = "DefaultAccount"

    def at_cmdset_creation(self):
        """
        Populates the cmdset
        """
        super().at_cmdset_creation()
        self.add(CmdDRAccountCharacters())
        self.add(CmdDRAccountCreateCharacter())
        self.add(CmdDRAccountHelp())


class UnloggedinCmdSet(default_cmds.UnloggedinCmdSet):
    """
    Command set available to the Session before being logged in.  This
    holds commands like creating a new account, logging in, etc.
    """

    key = "DefaultUnloggedin"

    def at_cmdset_creation(self):
        """
        Populates the cmdset
        """
        super().at_cmdset_creation()
        #
        # any commands you add below will overload the default ones.
        #


class SessionCmdSet(default_cmds.SessionCmdSet):
    """
    This cmdset is made available on Session level once logged in. It
    is empty by default.
    """

    key = "DefaultSession"

    def at_cmdset_creation(self):
        """
        This is the only method defined in a cmdset, called during
        its creation. It should populate the set with command instances.

        As and example we just add the empty base `Command` object.
        It prints some info.
        """
        super().at_cmdset_creation()
        #
        # any commands you add below will overload the default ones.
        #
