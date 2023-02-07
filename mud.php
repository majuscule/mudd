<?php

abstract class model {

    private $config_file = '/etc/mud.ini';
    private $db;

    public function __construct() {
        $config = parse_ini_file($this->config_file, true);
        $this->db = new mysqli(
            $config['database']['domain'],
            $config['database']['user'],
            $config['database']['password'],
            $config['database']['database']);
        if (mysqli_connect_errno()) {
            echo "Problem connecting to database: ";
            echo mysqli_connect_error();
            exit();
        }
    }

    public function query() {
        $args = func_get_args();
        $statement = $this->db->prepare(array_shift($args));
        #if ($args) call_user_func_array(array($statement, 'bind_param'), &$args);
        if ($args) call_user_func_array(array($statement, 'bind_param'), $args);
        $statement->execute();
        $statement->store_result();
        $statement->store_result();
        $data = $statement->result_metadata();
        $return = $row = $fields = array();
        $fields[0] = &$statement;
        while($field = $data->fetch_field())
            $fields[] = &$row[$field->name];
        call_user_func_array("mysqli_stmt_bind_result", $fields);
        $i = 0;
        while ($statement->fetch()) {
            foreach ($row as $key=>$value) $return[$i][$key] = $value;
            $i++;
        }
        $statement->free_result();
        return $return;
    }

    public function insert() {
        $args = func_get_args();
        $statement = $this->db->prepare(array_shift($args));
        call_user_func_array(array($statement, 'bind_param'), $args);
        $statement->execute();
        return $this->db->insert_id;
    }

    public function update() {
        $args = func_get_args();
        $statement = $this->db->prepare(array_shift($args));
        call_user_func_array(array($statement, 'bind_param'), $args);
        $statement->execute();
        return $this->db->insert_id;
    }

}

class universe {
    public $rows = 30;
    public $columns = 30;
    public $rooms = array();

    public function __construct($db) {
        $rooms = $db->query('SELECT id,x,y,state FROM rooms');
        if ($rooms) {
            foreach ($rooms as $room) {
                $this->rooms[$room['x']][$room['y']] =
                    array('id' => $room['id'], 'state' => $room['state']);
            }
        } else {
            $sql = 'INSERT INTO rooms (x,y,state) VALUES(?,?,?)';
            $types = 'iii';
            for ($x = 0; $x < $this->columns; $x++) {
                $column = array();
                for ($y = 0; $y < $this->rows; $y++) {
                    $state = (rand(0, 9) < 2 ? true : false);
                    $id = $db->insert($sql, $types, $x, $y, $state);
                    $this->rooms[$x][$y] = 
                        array('id' => $id, 'state' => $state);
                }
            }
        }
    }

    public function serialize() {
        $serial = array();
        for ($x = 0; $x < $this->columns; $x++) {
            for ($y = 0; $y < $this->rows; $y++) {
                $serial[$x][$y] = $this->rooms[$x][$y]['state'];
            }
        }
        return $serial;
    }

}

class player {

    public $id;
    public $name;
    public $room;
    public $x;
    public $y;

    public function __construct($db) {
        $player = $db->query(
            'SELECT players.id, players.name, players.room, rooms.x, rooms.y'
            . ' FROM players LEFT JOIN rooms ON players.room = rooms.id'
            . ' WHERE players.id = ?',
            'i', $_SESSION['id']
        );
        $player = $player[0];
        $this->id = $player['id'];
        $this->name = $player['name'];
        $this->room = $player['room'];
        $this->x = $player['x'];
        $this->y = $player['y'];
    }

}

class mud extends model {

    private $universe;

    public function __construct() {
        parent::__construct();
        session_start();
        $this->universe = new universe($this);
    }

    private function join() {
        $x = $y = 0;
        do {
            $x = rand(0, count($this->universe->rooms)-1);
            $y = rand(0, count($this->universe->rooms[0])-1);
        } while ($this->universe->rooms[$x][$y]['state']);
        $id = $this->insert('INSERT INTO players (name,room) VALUES(?,?)',
                            'si', $_GET['name'], $this->universe->rooms[$x][$y]['id']);
        $_SESSION['id'] = $id;
        //$others = $this->query('SELECT id, room FROM players WHERE id != ?', 'i', $this->player->id);
        return array('x' => $x, 'y' => $y, 'id' => $id, 'poll' => $this->poll());
    }

    private function yell($msg) {
        if (!$msg) $this->error('400', 'expected `msg` field');
        $this->insert(
            'INSERT INTO messages (message,type,room,source) VALUES(?,?,?,?)',
            'ssii', $msg, 'yell', $this->player->room, $this->player->id);
    }

    private function say($msg) {
        if (!$msg) $this->error('400', 'expected `dest` field');
        $this->insert(
            'INSERT INTO messages (message,type,room,source) VALUES(?,?,?,?)',
            'ssii', $msg, 'say', $this->player->room, $this->player->id);
    }

    private function tell($dest, $msg) {
        if (!$dest || !$msg) $this->error('400', 'expected `dest` and `msg` fields');
        $player = $this->query('SELECT id FROM players where name = ?', 's', $dest);
        if (!($player && $player['id']))
            $this->error(400, "could not find a player with `name` == $dest");
        $this->insert(
            'INSERT INTO messages (message,type,destination,source) VALUES(?,?,?,?)',
            'ssii', $msg, 'say', $player['id'], $this->player->id);
    }

    private function move($direction) {
        $directions = array(
            'north' => array('x' => $this->player->x,   'y' => $this->player->y-1),
            'east'  => array('x' => $this->player->x+1, 'y' => $this->player->y),
            'south' => array('x' => $this->player->x,   'y' => $this->player->y+1),
            'west'  => array('x' => $this->player->x-1, 'y' => $this->player->y),
        );
        if ($directions[$direction]) {
            $rooms = $this->query(
                'SELECT id, state, description FROM rooms WHERE x = ? and y = ?',
                'ii', $directions[$direction]['x'], $directions[$direction]['y']);
            if ($rooms[0] && !$rooms[0]['state']) {
                $this->update('UPDATE players SET room = ? WHERE players.id = ?',
                    'si', $rooms[0]['id'], $this->player->id);
                return array('description' => $rooms[0]['description']);
            } else {
                $this->error(403, 'your path is blocked');
            }
        } else
            $this->error(400, 'expected `direction` field with value {north|east|south|west}');
    }

    private function poll() {
        $time = isset($_SESSION['last_polled']) ? $_SESSION['last_polled'] : 0;
        $messages = $this->query(
            'SELECT message, type, name, sent, players.id FROM messages LEFT JOIN players'
            . ' ON destination = players.id'
            . ' OR source = players.id'
            . ' WHERE TIMESTAMPDIFF(MINUTE, sent, NOW()) < 5'
            . ' AND UNIX_TIMESTAMP(sent) >= ?'
            . ' AND (type = "yell"'
                . ' OR (type = "tell" AND destination = ?)'
                . ' OR (type = "say" AND messages.room = ?))',
            'iii', $time, $this->player->id, $this->player->room);
        $players = $this->query(
            'SELECT players.id, name, x ,y '
            . 'FROM players JOIN rooms '
            . 'ON players.room = rooms.id');
        $_SESSION['last_polled'] = time();
        return array('messages' => $messages, 'players' => $players);
    }

    public function response($content) {
        header('Content-Type: application/json');
        echo json_encode($content);
    }

    public function command($cmd) {
        if (!$_GET['cmd'])
            $this->error(400, 'Missing command: expected `cmd` field');
        if (($_GET['cmd'] != 'join' && $_GET['cmd'] != 'kick')
            && $_GET['cmd'] != 'start' && !isset($_SESSION['id']))
            $this->error(401, 'Missing user ID: please join first');
        if (isset($_SESSION['id'])) $this->player = new player($this);
        switch ($cmd) {
            case 'start':
                $this->response($this->universe->serialize());
                break;
            case 'join':
                $this->response($this->join());
                break;
            case 'move':
                $this->response($this->move($_GET['direction']));
                break;
            case 'tell':
                $this->tell($_GET['msg']);
                break;
            case 'yell':
                $this->yell($_GET['msg']);
                break;
            case 'say':
                $this->say($_GET['msg']);
                break;
            case 'tell':
                $this->tell($_GET['dest'], $_GET['msg']);
                break;
            case 'poll':
                $this->response($this->poll());
                break;
            case 'kick':
                $this->update('DELETE FROM players');
                break;
            default:
                $this->error(400, 'unknown command');
        }
    }

    private function error($status, $msg) {
        header("HTTP/1.0 $status");
        echo $msg;
        exit;
    }

}

$mud = new mud();
$mud->command($_GET['cmd']);

?>
