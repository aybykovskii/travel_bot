import express from 'express'
import mongoose, { model, Schema } from 'mongoose'
import fs from 'node:fs'
import path from 'node:path'
import { Telegraf } from 'telegraf'

const app = express()
const bot = new Telegraf(process.env.BOT_TOKEN!)

const guide = fs.readFileSync(path.join(__dirname, 'files', 'guide.pdf'))
const planner = fs.readFileSync(path.join(__dirname, 'files', 'planner.png'))

const timeouts = new Map<number, NodeJS.Timeout>()

const UserModel = model(
	'User',
	new Schema(
		{
			id: Number,
			name: String,
			tg: String,
		},
		{
			toObject: {
				transform: (_doc, ret) => {
					ret._id = _doc._id?.toString()

					return ret
				},
			},
			timestamps: {
				createdAt: 'createdAt',
				updatedAt: 'updatedAt',
			},
		}
	)
)

bot.command('send_all', async (ctx) => {
  const msg = ctx.message.text.substring(9)

  const users = await UserModel.find()

  for (const user of users) {
    ctx.telegram.sendMessage(user.id, msg)
  }

  ctx.reply('Отправлено!')
})

bot
.start(async (ctx) => {
  ctx
  .reply(
    `Рада, что ты здесь! 💗\n\nЛови гайд КАК СПЛАНИРОВАТЬ ПУТЕШЕСТВИЕ СВОИМ ХОДОМ В ЛЮБУЮ СТРАНУ 🌍\n\nЖелаю приятного планирования! ✨`)
  ctx.telegram.sendDocument(ctx.chat.id, { source: guide, filename: 'Гайд_планирование_путешествий_@daaspil.pdf' })

  const user = await UserModel.findOne({ id: ctx.chat.id })

  if (!user) { 
    UserModel.create({
      id: ctx.chat.id,
      name: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' '),
      tg: ctx.from?.username ?? '',
    })
  }

  const timeout = setTimeout(() => {
    ctx.reply('Удалось посмотреть планер? Напиши свое мнение в ответ на это сообщение')
    timeouts.delete(ctx.chat.id)
  }, 1000 * 60 * 60)

  timeouts.set(ctx.chat.id, timeout)
})

.on('message', async (ctx) => {
  const { message } = ctx

  if (message && 'text' in message && message.text.trim().toLowerCase() === 'планирование') {
    ctx.reply('Твой тревел-планер тебя уже заждался! 💗\n\nДля получения планера подпишись на телеграм-канал Путеводитель Мечтателя https://t.me/thedreamersguide 🗺✨\n\nИ затем напиши сюда слово "готово"')
  }

  if (message && 'text' in message && message.text.trim().toLowerCase() === 'готово') {
    try {
      const member = await ctx.telegram.getChatMember(process.env.CHAT_ID!, ctx.from.id)

      console.log(member)

      if (['creator', 'administrator', 'member'].includes(member.status)) {        
        ctx.reply(`Спасибо за подписку! В канале тебя ждет много всего интересного из самых разных уголков света!🌍\n\nЛови планер для твоих будущих путешествий. Надеюсь, он поможет тебе при планировании 💗✨`)

        ctx.telegram.sendDocument(ctx.chat.id, { source: planner, filename: 'Тревел-планер @daaspil.png' })
      } else {
        ctx.reply('Упс! Не получилось. Давай попробуем еще раз. Подпишись на телеграм-канал и напиши слово "готово"☺️')
      }
    } catch (e) {
      console.error(e)
      ctx.reply('Упс! Не получилось. Давай попробуем еще раз. Подпишись на телеграм-канал и напиши слово "готово"☺️')
    }
  }
})


process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

app.use(express.json())
app.listen(3000, () => {
  console.log('Bot started on port 3000')
  
  mongoose
	.connect(process.env.MONGODB_URL!)
	.then(() => {
    console.info('Connected to mongoDB')
	})
	.catch((e) => {
    console.error(`Catch error while connecting to mongoDB: ${e}`)
	})

  bot.launch()
})