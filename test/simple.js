
var a = require('assertions')
var consistent = require('./consistent')
var es = require('event-stream')
var MuxDemux = require('..')

/*
  socket.io behaves like two linked EventEmitters.
  calling emit on one, triggers listeners on the other.

  (see RemoteEventEmitter)

  test that two streams match.

  create a master stream and slave streams,
  assert that every chunk written to the master
  is eventually written to the slave.

  OKAY, my disconnection error is in HERE
  somewhere in here, things are breaking after reconnecting.
  what is it?

  
*/


function pair(f) {
  var a = new MuxDemux()
  var b = new MuxDemux()
  a.pipe(b).pipe(a)
  return [a, b]
}

function randomNumberStream (max, count) {
  count = count || 20
  max   = max   || 10
  return es.readable(function (i, cb) {
    this.emit('data', Math.random() * max)
    if(i > count)
    this.emit('end')
    cb()
  })
}

;(function simple () {

  var p = pair()
  var server = p.pop()
  var client = p.pop()

  var master = consistent()
  var slave  = master.createSlave()

  server.on('connection', function (stream) {
    a.equal(stream.meta, 'simple')
    stream
      .pipe(slave)
  })

  randomNumberStream()
    .pipe(master)
    .pipe(client.createWriteStream('simple'))

  process.on('exit', slave.validate)

})();

//return
;(function through () {

  var p = pair()
  var server = p.shift()
  var client = p.shift()

  var master = consistent()
  var slave1  = master.createSlave()
  var slave2  = master.createSlave()

  server.on('connection', function (stream) {
    a.equal(stream.meta, 'through')
    stream.pipe(slave1).pipe(stream) //ECHO
  })

  randomNumberStream()
    .pipe(master)
    .pipe(client.createStream('through'))
    .pipe(slave2)
    .on('end', function () {
      slave1.validate()
      slave2.validate()
      console.log('slave 1,2 valid')
    })

})();


//  names do not have to be unique.
//  should create two seperate streams.


;(function double () {
  var p = pair()
  var server = p.shift()
  var client = p.shift()

  var master1 = consistent()
  var slave1  = master1.createSlave()
  var master2 = consistent()
  var slave2  = master2.createSlave()

  server.on('connection', function (stream) {
    a.equal(stream.meta, 'through')
    stream.pipe(stream) //ECHO
  })

  randomNumberStream()
    .pipe(master1)
    .pipe(client.createStream('through'))
    .pipe(slave1)
    .on('end', function () {
      slave1.validate()
      console.log('slave1 valid')
    })

  //okay! this is breaking
  randomNumberStream()
    .pipe(master2)
    .pipe(client.createStream('through'))
    .pipe(slave2)
    .on('end', function () {
      slave2.validate()
      console.log('slave2 valid')
    })
})();

/*
  since I'm here, I may as well implement pausing
  etc.

  pass through pause, so that it can be used
  to control stuff like scrolling.
*/

/*
if a function respects pause, that means that on pause(),
the next write should return false.

then, on resume() the next write should return true

this case is pretty simple.
*/


;(function passesPauseThrough(stream) {
  var p = pair()
  var server = p.pop()
  var client = p.pop()

  server.on('connection', function (stream) {
    a.equal(stream.meta, 'paused')
    stream
    var i = 0
    stream.on('data', function () {
      if(i++ % 2)
        stream.pause()
      else //if (stream.paused)
        stream.resume()
    })
  })

  master = (client.createWriteStream('paused'))

  a.equal(master.write('hello'), true, 'should be free')
  a.equal(master.write('paused now'), false, 'should be paused')
  a.equal(master.write('hello'), true, 'should be free2')
  a.equal(master.write('paused now'), false, 'should be paused')

  master.end() 
  console.log('pause is correct')
})();

