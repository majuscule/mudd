$(document).ready(function(){
    
    var canvas = $('#universe')[0];
    var c = canvas.getContext('2d');
    var endpoint = '/mud/mud.php';

    function player(x, y) {
        this.x = x;
        this.y = y;

        this.move = function(direction) {
            var rooms = mud.rooms;
            switch (direction) {
                case 'left':
                case 'west':
                    if (rooms[this.x-1] && rooms[this.x-1][this.y]
                            && !rooms[this.x-1][this.y].state) {
                        rooms[this.x][this.y].clear();
                        rooms[this.x-1][this.y].join();
                        this.x--;
                    }
                    break;
                case 'up':
                case 'north':
                    if (rooms[this.x][this.y-1]
                            && !rooms[this.x][this.y-1].state) {
                        rooms[this.x][this.y].clear();
                        rooms[this.x][this.y-1].join();
                        this.y--;
                    }
                    break;
                case 'right':
                case 'east':
                    if (rooms[this.x+1] && rooms[this.x+1][this.y+1]
                        && !rooms[this.x+1][this.y].state) {
                        rooms[this.x][this.y].clear();
                        rooms[this.x+1][this.y].join();
                        this.x++;
                    }
                    break;
                case 'down':
                case 'south':
                    if (rooms[this.x][this.y+1]
                        && !rooms[this.x][this.y+1].state) {
                        rooms[this.x][this.y].clear();
                        rooms[this.x][this.y+1].join();
                        this.y++;
                    }
                    break;
            }
        }
    }

    function room(x, y, h, l) {
        this.x = x;
        this.y = y;
        this.h = h;
        this.l = l;
        this.state = 0;
        this.fill = function() {
            c.fillStyle = "rgb(0,0,0)";
            c.fillRect(this.x, this.y, this.h, this.l);
            this.state = 1;
        }
        this.clear = function() {
            c.fillStyle = "rgb(255,255,255)";
            c.fillRect(this.x, this.y, this.h, this.l);
            this.state = 0;
        }
        this.join = function() {
            c.fillStyle = "rgb(0,255,0)";
            c.fillRect(this.x, this.y, this.h, this.l);
        }
    }

    function universe() {

        this.rooms = [];

        this.rows = 30;
        this.columns = 30;

        this.roomWidth = canvas.width / this.rows;
        this.roomHeight = canvas.height / this.columns;

        for (var i = 0; i < this.columns; i++) {
            var column = [];
            var x = i * this.roomWidth;
            var y = 0;
            for (var ii = 0; ii < this.columns; ii++) {
                column.push(new room(x, y, this.roomWidth, this.roomHeight));
                y += this.roomWidth;
                Math.random() > .2 ? column[ii].clear() : column[ii].fill();
            }
            this.rooms.push(column);
        }

        this.populate = function(seed) {
            for (var i = 0; i < this.rows; i++) {
                for (var ii = 0; ii < this.columns; ii++) {
                    seed[i][ii] ? this.rooms[i][ii].clear()
                                : this.rooms[i][ii].fill();
                }
            }
        }

        this.join = function() {
            do {
                var x = Math.floor(Math.random()*(this.columns));
                var y = Math.floor(Math.random()*(this.rows));
            } while (!this.rooms[x][y].state);
            this.rooms[x][y].join();
            return player = new player(x,y);
        }

        $(document).keydown(function(e) {
            if (typeof player == undefined) return;
            switch (e.which) {
                case 37:
                    player.move('left');
                    break;
                case 38:
                    player.move('up');
                    break;
                case 39:
                    player.move('right');
                    break;
                case 40:
                    player.move('down');
                    break;
                default:
                    return;
            }
            e.preventDefault();
        });

        var commands = {
            tell : function(msg) {
                var parts = msg.match(/^(\w+)\s(.*)/);
                var dest = parts[1];
                msg = parts[2];
                $.ajax({
                    url: endpoint,
                    data: { 'cmd' : 'tell', 'dest' : dest, 'msg' : msg },
                    success: function() {
                        writeToLog('You told ' + dest + ': ', 'tell', msg);
                    },
                });
            },
            yell : function(msg) {
                console.log('yell!');
                $.ajax({
                    url: endpoint,
                    data: { 'cmd' : 'yell', 'msg' : msg },
                    success: function() {
                        writeToLog('You yelled: ', 'yell', msg);
                    },
                });
            },
            move : function(direction) {
                player.move(direction);
            },
        }
        function writeToLog(action, style, msg) {
            $('#log').append(
                $('<div>').addClass('logline').append(
                    $('<span>').addClass(style).text(action),
                    $('<span>').addClass('msg').text(msg)
                )
            )
        }
        $('#submit').click(function() {
            var text = $('#chat').val();
            var parts = text.match(/^(\w+)\s(.*)/);
            var cmd = parts[1];
            text = parts[2];
            if (commands[cmd] != undefined) {
                commands[cmd](text);
                $('#chat').val('');
            }
        });
        $('#chat').keypress(function(e) {
            if (e.which == '13') {
                $('#submit').click();
            }
        });

    }

    var mud = new universe;
    var player = mud.join();

});
