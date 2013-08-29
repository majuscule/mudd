$(document).ready(function(){
    
    var canvas = $('#universe')[0];
    var c = canvas.getContext('2d');
    var endpoint = '/mud/mud.php';

    function player(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;

        mud.rooms[this.x][this.y].join();

        this.move = function(direction) {
            var rooms = mud.rooms;
            switch (direction) {
                case 'left':
                case 'west':
                    if (rooms[this.x-1] && rooms[this.x-1][this.y]
                            && !rooms[this.x-1][this.y].state) {
//                        $.get(endpoint, {
//                                'cmd' : 'move',
//                                'name' : 'majuscule',
//                                'direction' : 'west'
//                            }, function() {
                            rooms[this.x][this.y].clear();
                            rooms[this.x-1][this.y].join();
                            this.x--;
//                        });
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
                    if (rooms[this.x+1] && rooms[this.x+1][this.y]
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

    function room(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.state = 0;
        this.fill = function() {
            c.fillStyle = "rgb(0,0,0)";
            c.fillRect(this.x, this.y, this.height, this.width);
            this.state = 1;
        }
        this.clear = function() {
            c.fillStyle = "rgb(255,255,255)";
            c.fillRect(this.x, this.y, this.height, this.width);
            this.state = 0;
        }
        this.join = function() {
            c.fillStyle = "rgb(0,255,0)";
            c.fillRect(this.x, this.y, this.height, this.width);
        }
    }

    function universe() {

        var self = this;
        this.rooms = [];

        this.build = function(seed) {
            this.rows = seed.length;
            this.columns = seed[0].length;
            this.roomWidth = canvas.width / this.rows;
            this.roomHeight = canvas.height / this.columns;

            for (var i = 0; i < this.columns; i++) {
                this.rooms[i] = [];
                var x = i * this.roomWidth;
                var y = 0;
                for (var ii = 0; ii < this.rows; ii++) {
                    this.rooms[i][ii] = new room(x, y, this.roomWidth, this.roomHeight);
                    if (seed[i][ii]) this.rooms[i][ii].fill();
                    y += this.roomHeight;
                }
            }
        }

        this.join = function() {
            $.getJSON(endpoint, { 'cmd' : 'join' }, function(json) {
                self.player = new player(json.x, json.y, json.id);
                setInterval(self.poll, 1000);
            });
        }

        var commands = {
            tell : function(msg) {
                       console.log(msg);
                var parts = msg.match(/^(\w+)\s(.*)/);
                if (!parts[1]) return;
                var dest = parts[1];
                msg = parts[2];
//                $.ajax({
//                    url: endpoint,
//                    data: { 'cmd' : 'tell', 'dest' : dest, 'msg' : msg },
//                    success: function() {
                        writeToLog('You told ' + dest + ': ', 'tell', msg);
//                    },
//                });
            },
            yell : function(msg) {
                $.ajax({
                    url: endpoint,
                    data: { 'cmd' : 'yell', 'msg' : msg },
                    success: function() {
                        writeToLog('You yelled: ', 'yell', msg);
                    },
                });
            },
            say : function(msg) {
//                $.ajax({
//                    url: endpoint,
//                    data: { 'cmd' : 'yell', 'msg' : msg },
//                    success: function() {
                        writeToLog('You said: ', 'say', msg);
//                    },
//                });
            },
            move : function(direction) {
                this.player.move(direction);
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
            if (parts) {
                var cmd = parts[1];
                text = parts[2];
                if (commands[cmd] != undefined) {
                    commands[cmd](text);
                    $('#chat').val('');
                }
            }
        });
        $('#chat').keydown(function(e) {
            if (e.which == '13') {
                $('#submit').click();
            } else if (e.which >= 37 && e.which <= 40)
                e.stopPropagation();
        });
        $('#join').click(function() {
            mud.join();
            $(this).fadeOut('slow');
        });

        $(document).keydown(function(e) {
            if (typeof self.player == 'undefined') return;
            switch (e.which) {
                case 37:
                    self.player.move('left');
                    break;
                case 38:
                    self.player.move('up');
                    break;
                case 39:
                    self.player.move('right');
                    break;
                case 40:
                    self.player.move('down');
                    break;
                default:
                    return;
            }
            e.preventDefault();
        });

        $.getJSON(endpoint, { 'cmd' : 'start' }, function(json) {
            self.build(json)
        })
        .fail(function(jqxhr, textStatus, error) {
            console.log(jqxhr, jqxhr.responseText, textStatus, error);
        });

        this.poll = function() {
            $.getJSON(endpoint, { 'cmd' : 'poll' }, function(messages) {
                for (var i in messages) {
                    var msg = messages[i];
                    if (msg.id == self.player.id) continue;
                    writeToLog(msg.name + ':', msg.type, msg.message);
                }
            });
        }
    }

    mud = new universe;

});
