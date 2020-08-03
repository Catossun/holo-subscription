import { StreamerImageDict, LiveInfo } from 'holo-schedule'
import admin = require('firebase-admin');
admin.initializeApp();
import { Subscription } from "../types";

const SUBSCRIPTIONS = 'subscriptions'

export function liveKey(live: LiveInfo) {
  return live.link.replace('https://www.youtube.com/watch?v=', '')
}

export function getFirestore() {
  return admin.firestore();
}

interface StreamerImagesDoc {
  vtuber: string
  img : string
}

export async function getStreamerImageDict() {
  const db = getFirestore()
  const snapshot = await db.collection('streamerImages').get()
  const dict: StreamerImageDict = {}
  snapshot.forEach(x => {
    const { vtuber, img } = (x.data() as StreamerImageDict)
    dict[vtuber] = img
  });

  return dict
}

export async function setStreamerImageDict(dict: Record<string, string>): Promise<void> {
  const db = getFirestore()
  const batch = db.batch()
  const ref = db.collection('streamerImages')
  Object.entries(dict).forEach(([vtuber, img]) => {
    const doc: StreamerImagesDoc = { vtuber, img }
    batch.set(ref.doc(vtuber), doc)
  })

  await batch.commit()
}

function subscriptionKey(chatId: number, vtuber: string) {
  return `${chatId}-${vtuber}`
}

function subscriptionDoc(subscription: Subscription) {
  const { chatId, vtuber } = subscription
  const db = getFirestore()
  const subscriptionsRef = db.collection(SUBSCRIPTIONS)

  const key = subscriptionKey(chatId, vtuber)
  return subscriptionsRef.doc(key)
}
export async function addSubscription(subscription: Subscription): Promise<void> {
  const doc = subscriptionDoc(subscription)
  await doc.set(subscription)
}

export async function removeSubscription(subscription: Subscription): Promise<void> {
  const doc = subscriptionDoc(subscription)
  await doc.delete()
}

export async function getSubscribedVtubers(chatId: number): Promise<string[]> {
  const ref = getSubscriptionsRef()
  const subs = await ref.where('chatId', '==', chatId).get()
  const vtubers: string[] = []
  subs.forEach(sub => {
    vtubers.push((sub.data() as Subscription).vtuber)
  })

  return vtubers
}

export function getSubscriptionsRef() {
  const db = getFirestore()
  return db.collection(SUBSCRIPTIONS)
}

export function getScheduleRef() {
  const db = getFirestore()
  return db.collection('schedule');
}

interface IncomingNotification {
  sent: boolean
  liveId: string
}

export async function createIncomingNotifications(lives: LiveInfo[]) {
  const db = getFirestore()
  const ref = db.collection('incomingNotifications')

  const liveIds = lives.map(x => liveKey(x))
  const currentNotifications = await ref.where('liveId', 'in', liveIds).get()
  const currentNotificationsSet = new Set()
  currentNotifications.forEach(x => {
    const doc = x.data() as IncomingNotification
    currentNotificationsSet.add(doc.liveId)
  })

  const batch = db.batch()
  lives.forEach(async (live) => {
    const liveId = liveKey(live)
    const docRef = ref.doc(liveId)

    if (!currentNotificationsSet.has(liveId)) {
      batch.set(docRef, { sent: false, liveId });
    }
  })

  await batch.commit()
}
