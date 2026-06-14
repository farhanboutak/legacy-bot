const { EmbedBuilder } = require('discord.js');

class EmbedService {
  static create(options = {}) {
    const embed = new EmbedBuilder()
      .setColor(options.color || '#2B2D31')
      .setTimestamp();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.footer) embed.setFooter({ text: options.footer });
    if (options.author) embed.setAuthor(options.author);
    if (options.fields) embed.addFields(options.fields);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);

    return embed;
  }

  static success(title, description, fields = []) {
    return this.create({
      title: `✓ ${title}`,
      description,
      fields,
      color: '#00FF00'
    });
  }

  static error(title, description, fields = []) {
    return this.create({
      title: `✗ ${title}`,
      description,
      fields,
      color: '#FF0000'
    });
  }

  static info(title, description, fields = []) {
    return this.create({
      title: `ℹ ${title}`,
      description,
      fields,
      color: '#0099FF'
    });
  }

  static warning(title, description, fields = []) {
    return this.create({
      title: `⚠ ${title}`,
      description,
      fields,
      color: '#FFA500'
    });
  }
}

module.exports = EmbedService;