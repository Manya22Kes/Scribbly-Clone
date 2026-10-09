export default class Player {
  constructor(id, name, avatar, ip) {
    this.id = id
    this.name = name
    this.avatar = avatar
    this.ip = ip
    this.score = 0
    this.hasGuessed = false
    this.ready = false
  }
}
