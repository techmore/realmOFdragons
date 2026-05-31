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

from commands.dr_commands import CmdDRAccountCharacters, CmdDRAccountCreateCharacter, CmdDRAccountHelp, CmdDRAim, CmdDRAdvance, CmdDRAppraise, CmdDRAttributes, CmdDRBash, CmdDRBlock, CmdDRBuildCrossing, CmdDRBuy, CmdDRCircle, CmdDRCombat, CmdDRCreateCharacter, CmdDRDefend, CmdDRDodge, CmdDRDrop, CmdDREquipment, CmdDRExperience, CmdDRFeint, CmdDRFlee, CmdDRForage, CmdDRForageGuide, CmdDRGet, CmdDRGuard, CmdDRGuildAbilities, CmdDRGuildBoon, CmdDRGuildCapstone, CmdDRGuildDrill, CmdDRGuildFocus, CmdDRGuildHistory, CmdDRGuildLesson, CmdDRGuildMentor, CmdDRGuildMilestone, CmdDRGuildPerkAction, CmdDRGuildPlan, CmdDRGuildsGuide, CmdDRGuildPassive, CmdDRGuildPath, CmdDRGuildPerks, CmdDRGuildPractice, CmdDRGuildRite, CmdDRGuildSignature, CmdDRGuildTechnique, CmdDRGuildTitle, CmdDRHands, CmdDRHealth, CmdDRHelp, CmdDRHunting, CmdDRHurl, CmdDRInventory, CmdDRJab, CmdDRJoinGuild, CmdDRJourney, CmdDRKick, CmdDRLoot, CmdDRManeuvers, CmdDRParry, CmdDRRace, CmdDRRange, CmdDRRegistrar, CmdDRRemove, CmdDRRepair, CmdDRRerollAttributes, CmdDRRespawn, CmdDRRest, CmdDRRetreat, CmdDRRevive, CmdDRRoom, CmdDRRoutes, CmdDRScan, CmdDRScore, CmdDRSell, CmdDRShoot, CmdDRShop, CmdDRShops, CmdDRSkills, CmdDRSkin, CmdDRStance, CmdDRStudy, CmdDRSurvey, CmdDRTalk, CmdDRTarget, CmdDRTask, CmdDRTasksGuide, CmdDRTend, CmdDRTrain, CmdDRUse, CmdDRWait, CmdDRWallet, CmdDRWear, CmdDRWield


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
        self.add(CmdDRAim())
        self.add(CmdDRAppraise())
        self.add(CmdDRAttributes())
        self.add(CmdDRBash())
        self.add(CmdDRBlock())
        self.add(CmdDRBuildCrossing())
        self.add(CmdDRBuy())
        self.add(CmdDRCircle())
        self.add(CmdDRCombat())
        self.add(CmdDRCreateCharacter())
        self.add(CmdDRDefend())
        self.add(CmdDRDodge())
        self.add(CmdDRDrop())
        self.add(CmdDREquipment())
        self.add(CmdDRExperience())
        self.add(CmdDRFeint())
        self.add(CmdDRFlee())
        self.add(CmdDRForage())
        self.add(CmdDRForageGuide())
        self.add(CmdDRGet())
        self.add(CmdDRGuard())
        self.add(CmdDRGuildAbilities())
        self.add(CmdDRGuildBoon())
        self.add(CmdDRGuildCapstone())
        self.add(CmdDRGuildDrill())
        self.add(CmdDRGuildFocus())
        self.add(CmdDRGuildHistory())
        self.add(CmdDRGuildLesson())
        self.add(CmdDRGuildMentor())
        self.add(CmdDRGuildMilestone())
        self.add(CmdDRGuildPerkAction())
        self.add(CmdDRGuildsGuide())
        self.add(CmdDRGuildPassive())
        self.add(CmdDRGuildPath())
        self.add(CmdDRGuildPlan())
        self.add(CmdDRGuildPerks())
        self.add(CmdDRGuildPractice())
        self.add(CmdDRGuildRite())
        self.add(CmdDRGuildSignature())
        self.add(CmdDRGuildTechnique())
        self.add(CmdDRGuildTitle())
        self.add(CmdDRHands())
        self.add(CmdDRHealth())
        self.add(CmdDRHelp())
        self.add(CmdDRHunting())
        self.add(CmdDRHurl())
        self.add(CmdDRInventory())
        self.add(CmdDRJab())
        self.add(CmdDRJoinGuild())
        self.add(CmdDRJourney())
        self.add(CmdDRKick())
        self.add(CmdDRLoot())
        self.add(CmdDRManeuvers())
        self.add(CmdDRParry())
        self.add(CmdDRRace())
        self.add(CmdDRRange())
        self.add(CmdDRRegistrar())
        self.add(CmdDRRemove())
        self.add(CmdDRRepair())
        self.add(CmdDRRerollAttributes())
        self.add(CmdDRRespawn())
        self.add(CmdDRRest())
        self.add(CmdDRRetreat())
        self.add(CmdDRRevive())
        self.add(CmdDRRoom())
        self.add(CmdDRRoutes())
        self.add(CmdDRScan())
        self.add(CmdDRScore())
        self.add(CmdDRSell())
        self.add(CmdDRShoot())
        self.add(CmdDRShop())
        self.add(CmdDRShops())
        self.add(CmdDRSkills())
        self.add(CmdDRSkin())
        self.add(CmdDRStance())
        self.add(CmdDRStudy())
        self.add(CmdDRSurvey())
        self.add(CmdDRTalk())
        self.add(CmdDRTarget())
        self.add(CmdDRTask())
        self.add(CmdDRTasksGuide())
        self.add(CmdDRTend())
        self.add(CmdDRTrain())
        self.add(CmdDRUse())
        self.add(CmdDRWait())
        self.add(CmdDRWallet())
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
