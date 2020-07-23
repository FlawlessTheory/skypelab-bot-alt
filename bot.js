/*const __API__ = 'https://random-chooser-backend.herokuapp.com/api/v1';*/

const restify = require('restify');
const builder = require('botbuilder');
const botbuilder_azure = require("botbuilder-azure");
const EventSource = require("eventsource");
const axios = require('axios');
const assert = require('assert');

// Запуск сервера restify
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Подключение к MongoDB
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://FlawlessTheory:flawlesstheory-flawedpractice@skypelab-bot.ohzx2.azure.mongodb.net/skypelab-bot?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true });

// Глобальные переменные для справочника ID каналов и подписок
let channelIds = [];
let subs = [];

// Подключение клиента к базе данных и заполнение глобальных переменных
client.connect().then(() => {
	return client.db("skypelab-bot").collection("subs").find().toArray();
}).then((subsCollection) => {
	subs = subsCollection;
}).then(() => {
	return client.db("skypelab-bot").collection("channelIds").find().toArray();
}).then((channelIdsCollection) => {
	channelIds = channelIdsCollection;
}).catch(err => {
	console.log(err);
});

const botName = "skypelab-bot";

// Create chat connector for communicating with the Bot Framework Service
//
const connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Прослушивание сообщений от пользователей
server.post('/api/messages', connector.listen());

const bot = new builder.UniversalBot(connector);

// Регистрация хранилища в памяти
const inMemoryStorage = new builder.MemoryBotStorage();
bot.set('storage', inMemoryStorage);

// На нераспознанные сообщения бот молчит
//
// Если не прописывать этот диалог, то бот будет крашиться на любом сообщении, не соответствующем прописанным условиям
// в иных диалогах
bot.dialog('/', [(session) => {
	session.endDialog();
}]);

// Приветствие
//
bot.dialog('start', [(session) => {
	session.send("Бот на связи и готов к работе. Отправьте '@SkypeLab help', чтобы вызвать справку по командам.");
}])
	.triggerAction({
		matches: /^@SkypeLab/
});

// Справка о командах
//
// Все пробелы и табуляции, поставленные в редакторе, сохраняются и в сообщении!
bot.dialog('help', [(session) => {
	session.send(`Список доступных команд:\n
    - setup - запись идентификатора беседы в базу данных;\n
    - subscribe - создать новую подписку на событие;\n
    - subs - посмотреть подписки для этого чата;\n
    - unsubscribe - удалить подписку.\n
Помните, что для вызова команды нужно меня упомянуть: @SkypeLab`);
}])
	.triggerAction({
		matches: /^@SkypeLab help/,
		onSelectAction: (session, args, next) => {
			session.beginDialog(args.action, args);
		}
});

// Запись идентификатора в БД
//
bot.dialog('setup', [(session) => {
	// Если канал не зарегистрирован
	if(!channelIdMatch(channelIds, session)) {
		const channelIdsCollection = client.db("skypelab-bot").collection("channelIds");
		channelIdsCollection.insertOne({channelId: session.message.address.channelId}).then(() => {
			// Обновление списка идентификаторов
			return channelIdsCollection.find().toArray();
		}).then((updatedCollection) => {
			channelIds = updatedCollection;
			session.send(`Ваш идентификатор канала ${session.message.address.channelId} сохранён.`);
		}).catch(err => {
			console.log(err);
		});
	} else {
		session.send(`Ваш идентификатор канала уже зарегистрирован.`);
	}
}])
		.triggerAction({
			matches: /^@SkypeLab setup/,
			onSelectAction: (session, args, next) => {
				session.beginDialog(args.action, args);
			}
		});

// Список подписок
//
bot.dialog('subs', [(session) => {
	if(subs.length > 0) {
		if(channelIdMatch(subs, session)) {
			let subsString = `Список подписок для данного канала: \n`;
			subs.forEach((element) => {
				// Отсеивание подписок, не относящихся к каналу
				if(session.message.address.channelId == element.channelId) {
					subsString += `- ${element.subName}\n`;
				}
			});

			session.send(subsString);
		}
		// Подписки для текущего канала не найдены
		else {
			session.send(`Подписок не найдено.`);
		}
	}
	// Подписок нет вообще
	else {
		session.send(`Список подписок пуст.`);
	}
}])
	.triggerAction({
		matches: /^@SkypeLab subs/,
		onSelectAction: (session, args, next) => {
			session.beginDialog(args.action, args);
		}
});

// Подписаться
//
// Prompts всегда принимает два аргумента: сессию и текст запроса
bot.dialog('subscribe', [function (session) {
		builder.Prompts.text(session, "Введите название проекта в формате 'группа/проект'.");
	},
	function (session, results) {
		session.dialogData.project = results.response;
		builder.Prompts.text(session, "Введите название события.");
	},
	function (session, results) {
		var subName = `${session.dialogData.project}_${results.response}`;

		if() {

		} else {
			session.send(`Подписка ${subname} уже существует.`);
		}
		const subsCollection = client.db("skypelab-bot").collection("subs");
		subsCollection.insertOne()
				.then()
				.catch(err => {
					console.log(err);
				});

		session.send(`Новая подписка для вашего канала: ${subName}. Используйте команду "@SkypeLab subs", чтобы увидеть все подписки.`);
	}])
	.endConversationAction("endSub", "Отмена", {
		matches: new RegExp(`/@SkypeLab cancel/`),
		confirmPrompt: "Уверены, что хотите прервать процесс?"
	})
	.triggerAction({
		matches: /^@SkypeLab subscribe/,
		onSelectAction: (session, args, next) => {
			session.beginDialog(args.action, args);
		}
});

// Отписаться
//
bot.dialog('unsubscribe', [ function (session) {
			builder.Prompts.text(session, "Введите идентификатор подписки для удаления");
},
		function (session, results) {
			var subId = results.response;

			if(subs.includes(subId)) {
				subs.splice(subId);
				session.send("Подписка удалена.");
			} else {
				session.send("Подписка не найдена. Используйте команду \"@SkypeLab subs\", чтобы увидеть все подписки.");
			}
		}])
	.endConversationAction("endUnsub", "Отмена", {
		matches: new RegExp(`/@SkypeLab cancel/`),
		confirmPrompt: "Уверены, что хотите прервать процесс?"
	})
	.triggerAction({
		matches: /^@SkypeLab unsubscribe/,
		onSelectAction: (session, args, next) => {
			session.beginDialog(args.action, args);
		}
});

function objectPropertyMatch(targetArray, property, value) {
	let flag = false;

	targetArray.forEach((element) => {
		if(element[property] == value) {
			flag = true;
		}
	});

	return flag;
}