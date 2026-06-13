const prisma = require('../services/db');
const balanceService = require('../services/balance.service');

// Get all groups for the logged-in user
const getUserGroups = async (req, res) => {
  try {
    const memberships = await prisma.groupMembership.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const groups = memberships.map(m => m.group);
    return res.status(200).json({ groups });
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return res.status(500).json({ error: 'An error occurred while fetching groups.' });
  }
};

// Create a new group
const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        memberships: {
          create: {
            userId: req.user.id,
            joinedAt: new Date(),
          }
        }
      },
      include: {
        memberships: {
          include: { user: true }
        }
      }
    });

    return res.status(201).json({ group });
  } catch (error) {
    console.error('Error creating group:', error);
    return res.status(500).json({ error: 'An error occurred while creating the group.' });
  }
};

// Add a user to a group with specific timeline
const addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email, joinedAt, leftAt } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(404).json({ error: `User with email '${email}' not found.` });
    }

    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Check if membership already exists
    const existingMembership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId: user.id,
        leftAt: null // check for currently active memberships
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already an active member of this group.' });
    }

    const membership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId: user.id,
        joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
        leftAt: leftAt ? new Date(leftAt) : null
      },
      include: { user: true }
    });

    return res.status(201).json({
      message: 'Member added to group successfully.',
      membership
    });
  } catch (error) {
    console.error('Error adding member:', error);
    return res.status(500).json({ error: 'An error occurred while adding the member.' });
  }
};

// Remove or mark a member as left (for timeline end)
const removeMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { leftAt } = req.body; // the date they left (e.g. Meera left end of March)

    // Find active membership
    const membership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId,
        leftAt: null
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Active membership not found for this user in this group.' });
    }

    // Update with leftAt date
    const updatedMembership = await prisma.groupMembership.update({
      where: { id: membership.id },
      data: {
        leftAt: leftAt ? new Date(leftAt) : new Date()
      }
    });

    return res.status(200).json({
      message: 'User membership terminated successfully.',
      membership: updatedMembership
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({ error: 'An error occurred while terminating membership.' });
  }
};

// Get group details and memberships
const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    return res.status(200).json({ group });
  } catch (error) {
    console.error('Error fetching group details:', error);
    return res.status(500).json({ error: 'An error occurred while fetching group details.' });
  }
};

// Calculate and return group wise balances and settlement calculations
const getGroupBalances = async (req, res) => {
  try {
    const { groupId } = req.params;

    const balances = await balanceService.calculateGroupBalances(groupId);

    return res.status(200).json({ balances });
  } catch (error) {
    console.error('Error calculating balances:', error);
    return res.status(500).json({ error: error.message || 'An error occurred while calculating balances.' });
  }
};

module.exports = {
  getUserGroups,
  createGroup,
  addMember,
  removeMember,
  getGroupDetails,
  getGroupBalances
};
