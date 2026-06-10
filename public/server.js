const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { WEBSITE_URL } = require('../server');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LICENSE_FILE = path.join(__dirname, 'licenses.json');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const TICKET_CHANNEL_ID = process.env.TICKET_CHANNEL_ID || '1497978320963240107';
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID || '1498057394981179522';
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || '1499170117756391464';
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '1499170175440654398';
const CONFIG_FILE = path.join(__dirname, 'config.json');
const RATE_LIMIT_COUNT = 2;
const RATE_LIMIT_HOURS = 24;

function hasUnlimitedRole(member) {
  if (!member) return false;
  return member.roles.cache.has(OWNER_ROLE_ID) || member.roles.cache.has(ADMIN_ROLE_ID) || member.roles.cache.has(STAFF_ROLE_ID);
}

function canCreateLicense(authorId, member) {
  if (hasUnlimitedRole(member)) return true;
  if (!authorId) return true;
  const licenses = loadLicenses();
  const cutoff = Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000;
  return licenses.filter(license => license.creatorId === authorId && new Date(license.createdAt).getTime() >= cutoff).length < RATE_LIMIT_COUNT;
}

function licenseCount() {
  return loadLicenses().length;
}

if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CHANNEL_ID in .env');
  process.exit(1);
}

function loadLicenses() {
  if (!fs.existsSync(LICENSE_FILE)) return [];
  try {
    const raw = fs.readFileSync(LICENSE_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Cannot read licenses.json', err);
    return [];
  }
}

function saveLicenses(licenses) {
  try {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenses, null, 2));
  } catch (err) {
    console.error('Cannot write licenses.json', err);
  }
}

function generateLicenseCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const gen = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SYM_${gen()}_${gen()}_${gen()}`;
}

function createLicense({ note = 'discord', creatorId = '', creatorTag = '' } = {}) {
  const licenses = loadLicenses();
  const license = {
    code: generateLicenseCode(),
    status: 'UNUSED',
    createdAt: new Date().toISOString(),
    usedAt: '',
    usedBy: '',
    note,
    creatorId,
    creatorTag,
    logs: [
      {
        when: new Date().toISOString(),
        by: creatorTag || note,
        action: 'generated',
        details: creatorId ? `ID: ${creatorId}` : ''
      }
    ]
  };
  licenses.unshift(license);
  saveLicenses(licenses);
  return license;
}

function findLicense(code) {
  const licenses = loadLicenses();
  return licenses.find(license => license.code === code);
}

function markLicenseUsed(code, usedBy = 'website') {
  const licenses = loadLicenses();
  const license = licenses.find(item => item.code === code);
  if (!license || license.status === 'USED') return false;
  license.status = 'USED';
  license.usedAt = new Date().toISOString();
  license.usedBy = usedBy;
  license.logs.push({ when: new Date().toISOString(), by: usedBy, action: 'used' });
  saveLicenses(licenses);
  return true;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`Discord bot ready as ${client.user.tag}`);
  loadTicketChannel();
});

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return { ticketChannelId: null };
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    console.error('Cannot read config.json', err);
    return { ticketChannelId: null };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Cannot write config.json', err);
  }
}

async function loadTicketChannel() {
  const config = loadConfig();
  if (!config.ticketChannelId) return;
  try {
    const channel = await client.channels.fetch(config.ticketChannelId);
    if (!channel) return;
    const messages = await channel.messages.fetch({ limit: 10 });
    const ticketMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('New Login Activity'));
    if (!ticketMsg) {
      postTicketMessage(channel);
    }
  } catch (err) {
    console.error('Failed to load ticket channel', err);
  }
}

async function postTicketMessage(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🔒 New Login Activity Detected')
    .setDescription('Click the button below to generate your one-time Shadow Hub license. It will be sent to your DM.')
    .setColor(0xF43F5E)
    .addFields(
      { name: 'Application', value: 'UID BYPASS', inline: true },
      { name: 'Licenses Created', value: `${licenseCount()}`, inline: true },
      { name: 'DM Notice', value: 'License will be delivered in English via DM only', inline: true },
      { name: 'Website', value: `[UID white list website](${WEBSITE_URL})`, inline: true }
    )
    .setFooter({ text: 'SHADOW HUB SYSTEM • Ticket mode' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('generate_license_ticket')
      .setLabel('Generate License')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel('Buy / Support')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${channel.guildId}/${TICKET_CHANNEL_ID}`)
  );

  try {
    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('Failed to post ticket message', err);
  }
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const text = message.content.trim();
  
  if (text.startsWith('/setup')) {
    try {
      if (!message.member?.permissions.has('ManageGuild')) {
        return await message.reply('❌ You need **Manage Server** permission to use this command.');
      }
      const config = loadConfig();
      config.ticketChannelId = message.channelId;
      saveConfig(config);
      await postTicketMessage(message.channel);
      return await message.reply('✅ Ticket channel configured. License generation button is ready!');
    } catch (err) {
      console.error('Error in /setup command:', err);
      return await message.reply('❌ Error setting up ticket channel. Check bot permissions.');
    }
  }

  if (text.startsWith('!licence') || text.startsWith('!license')) {
    if (!message.guild) return;
    if (!canCreateLicense(message.author.id, message.member)) {
      return await message.reply('❌ You have reached the limit of 2 licenses in 24 hours. Try again later.');
    }

    const license = createLicense({
      note: `generated by ${message.author.tag}`,
      creatorId: message.author.id,
      creatorTag: message.author.tag
    });

    const userLicenses = loadLicenses().filter(l => l.creatorId === message.author.id).length;
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();

    const embed = new EmbedBuilder()
      .setTitle('✅ UID Successfully Added')
      .setDescription('License generated successfully. Use the code below to login via the whitelist website.')
      .setColor(0x22C55E)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'Application', value: 'UID BYPASS', inline: true },
        { name: 'Status', value: 'Login Successful', inline: true },
        { name: 'User', value: `${message.author.tag}`, inline: true },
        { name: 'UID', value: `${message.author.id}`, inline: true },
        { name: 'Duration', value: '24 Hours', inline: true },
        { name: 'Slot', value: '1 / 1 Used', inline: true },
        { name: 'Licenses Generated', value: `${userLicenses}`, inline: true },
        { name: 'Expiry Time', value: expiry, inline: true },
        { name: 'License Key', value: `\`${license.code}\``, inline: false },
        { name: 'Website', value: `[UID white list website](${WEBSITE_URL})`, inline: false }
      )
      .setFooter({ text: 'Shadow Hub Licence System' })
      .setTimestamp();

    try {
      return await message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send licence log message', err);
      return await message.reply('❌ Could not send licence log.');
    }
  }

  if (!text.startsWith('/genlicense') && !text.startsWith('!genlicense')) return;
  if (!message.guild) return;

  const embed = new EmbedBuilder()
    .setTitle('🔒 New Login Activity Detected')
    .setDescription('A new UID bypass request has been received. Use the button below to generate a one-time license and send it privately via DM.')
    .setColor(0xF43F5E)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: 'Application', value: 'UID BYPASS', inline: true },
      { name: 'Status', value: 'Request Received', inline: true },
      { name: 'Licenses Created', value: `${licenseCount()}`, inline: true },
      { name: 'User', value: `${message.author.tag}`, inline: true },
      { name: 'DM Notice', value: 'License will be delivered in English via DM only', inline: true },
      { name: 'Website', value: `[UID white list website](${WEBSITE_URL})`, inline: true }
    )
    .setFooter({ text: 'SHADOW HUB SYSTEM • Ticket mode' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`generate_license_${message.author.id}`)
      .setLabel('Generate License')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel('Buy / Support')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${message.guild.id}/${TICKET_CHANNEL_ID}`)
  );

  try {
    await message.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('Failed to send ticket-style message', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;
  
  if (customId === 'generate_license_ticket') {
    if (!canCreateLicense(interaction.user.id, interaction.member)) {
      return interaction.reply({ content: `You have reached the limit of ${RATE_LIMIT_COUNT} licenses in ${RATE_LIMIT_HOURS} hours. Try again later.`, ephemeral: true });
    }

    const license = createLicense({
      note: `generated by ${interaction.user.tag}`,
      creatorId: interaction.user.id,
      creatorTag: interaction.user.tag
    });

    const dmEmbed = new EmbedBuilder()
      .setTitle('Your One-Time License')
      .setDescription('Your one-time license has been created successfully. Paste it into the website login box to access the whitelist.')
      .setColor(0x22C55E)
      .addFields(
        { name: 'License Code', value: `\`${license.code}\``, inline: false },
        { name: 'Application', value: 'UID BYPASS', inline: true },
        { name: 'Note', value: 'This license is valid for one login only.', inline: true },
        { name: 'Website', value: `[UID white list website](${WEBSITE_URL})`, inline: true }
      )
      .setFooter({ text: 'Sent by Shadow Hub Licence System' })
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.error('Failed to send DM to user', err);
      return interaction.reply({ content: 'Could not send DM. Please enable DMs from server members and try again.', ephemeral: true });
    }

    try {
      await interaction.reply({ content: '✅ License created and sent to your DM.', ephemeral: true });
    } catch (err) {
      console.error('Failed to reply to interaction', err);
    }
    return;
  }

  if (!customId.startsWith('generate_license_')) return;
  const authorId = customId.slice('generate_license_'.length);

  if (interaction.user.id !== authorId) {
    return interaction.reply({ content: 'Only the original requester can generate this license.', ephemeral: true });
  }

  if (!canCreateLicense(authorId, interaction.member)) {
    return interaction.reply({ content: `You have reached the limit of ${RATE_LIMIT_COUNT} licenses in ${RATE_LIMIT_HOURS} hours. Try again later.`, ephemeral: true });
  }

  const license = createLicense({
    note: `generated by ${interaction.user.tag}`,
    creatorId: interaction.user.id,
    creatorTag: interaction.user.tag
  });

  const dmEmbed = new EmbedBuilder()
    .setTitle('Your One-Time License')
    .setDescription('Your one-time license has been created successfully. Paste it into the website login box to access the whitelist.')
    .setColor(0x22C55E)
    .addFields(
      { name: 'License Code', value: `\`${license.code}\``, inline: false },
      { name: 'Application', value: 'UID BYPASS', inline: true },
      { name: 'Note', value: 'This license is valid for one login only.', inline: true },
      { name: 'Website', value: `[UID white list website](${WEBSITE_URL})`, inline: true }
    )
    .setFooter({ text: 'Sent by Shadow Hub Licence System' })
    .setTimestamp();

  try {
    await interaction.user.send({ embeds: [dmEmbed] });
  } catch (err) {
    console.error('Failed to send DM to user', err);
    return interaction.reply({ content: 'Could not send DM. Please enable DMs from server members and try again.', ephemeral: true });
  }

  try {
    await interaction.reply({ content: '✅ License created and sent to your DM.', ephemeral: true });
  } catch (err) {
    console.error('Failed to reply to interaction', err);
  }
});

client.login(DISCORD_TOKEN).catch(err => {
  console.error('Discord login failed:', err);
  process.exit(1);
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/licenses', (req, res) => {
  res.json(loadLicenses());
});

app.post('/verify-license', (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ message: 'License code is required' });
  }

  const license = findLicense(code);
  if (!license) {
    return res.status(404).json({ message: 'License not found' });
  }

  if (license.status === 'USED') {
    return res.status(400).json({ message: 'This license has already been used' });
  }

  markLicenseUsed(code, 'web-login');
  const updatedLicense = findLicense(code);
  res.json({ message: 'License accepted', license: updatedLicense });
});

app.post('/create-license', (req, res) => {
  const license = createLicense('website-create');
  res.json(license);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
