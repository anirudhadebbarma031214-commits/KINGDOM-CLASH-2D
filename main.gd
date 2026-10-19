extends Node2D

const SAVE_PATH := "user://kingdom_save.json"
var gold := 180
var wood := 140
var food := 120
var troops := 12
var castle_level := 1
var barracks_level := 1
var enemy_strength := 10
var message := "Welcome, Commander! Gather resources to grow."
var message_time := 4.0
var buttons: Array[Dictionary] = []
var flash := 0.0

func _ready() -> void:
	_load_game()
	get_viewport().size_changed.connect(queue_redraw)

func _process(delta: float) -> void:
	message_time = maxf(0.0, message_time - delta)
	flash = maxf(0.0, flash - delta)
	queue_redraw()

func _draw() -> void:
	var s := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO,s),Color("#527c4b"))
	draw_rect(Rect2(0,0,s.x,200),Color("#294d4b"))
	for i in range(5):
		draw_circle(Vector2(i*s.x/4.0,145+sin(i*1.4)*13),115,Color("#365d50"))
	for i in range(90):
		var x := fposmod(i*97.0+31.0,s.x)
		var y := 205.0+fposmod(i*53.0+9.0,maxf(1.0,s.y-205.0))
		draw_line(Vector2(x,y),Vector2(x+4,y-3),Color(0.8,0.9,0.5,0.4),1.5)
	draw_rect(Rect2(0,0,s.x,66),Color("#132630"))
	draw_rect(Rect2(0,64,s.x,3),Color("#d5ad59"))
	_txt("KINGDOM CLASH 2D",Vector2(18,28),22,Color("#f5d98b"))
	_txt("CASTLE LV "+str(castle_level),Vector2(20,51),13,Color.WHITE)
	_txt("GOLD "+str(gold),Vector2(s.x*.39,39),16,Color("#ffd166"))
	_txt("WOOD "+str(wood),Vector2(s.x*.55,39),16,Color("#e0bd95"))
	_txt("FOOD "+str(food),Vector2(s.x*.70,39),16,Color("#c7ed8c"))
	_txt("TROOPS "+str(troops),Vector2(s.x*.84,39),16,Color("#ffaaa5"))
	# Road
	draw_rect(Rect2(10,245,s.x-20,13),Color("#b5a37a"))
	# Castle with battlements and flag
	var cx := s.x*.27
	var cy := s.y*.45
	draw_rect(Rect2(cx-58,cy,116,68),Color("#aebbc0"))
	draw_rect(Rect2(cx-50,cy+8,100,51),Color("#d1d5cf"))
	for ox in [-58,-22,14,50]:
		draw_rect(Rect2(cx+ox,cy-20,26,29),Color("#7d9299"))
		draw_rect(Rect2(cx+ox+4,cy-16,18,20),Color("#b8c4c6"))
	draw_rect(Rect2(cx-14,cy+30,28,38),Color("#5b4335"))
	draw_line(Vector2(cx,cy-20),Vector2(cx,cy-59),Color("#f4e6b5"),3)
	draw_colored_polygon(PackedVector2Array([Vector2(cx,cy-59),Vector2(cx+29,cy-51),Vector2(cx,cy-42)]),Color("#c64f49"))
	_txt("YOUR CASTLE",Vector2(cx-49,cy+87),14,Color.WHITE)
	# Barracks
	var bx := s.x*.48
	draw_rect(Rect2(bx-34,cy+10,68,48),Color("#8c6347"))
	draw_colored_polygon(PackedVector2Array([Vector2(bx-41,cy+11),Vector2(bx,cy-18),Vector2(bx+41,cy+11)]),Color("#b54d3d"))
	draw_rect(Rect2(bx-8,cy+32,16,26),Color("#48362e"))
	_txt("BARRACKS",Vector2(bx-36,cy+81),12,Color.WHITE)
	# Farm
	var fx := s.x*.67
	draw_rect(Rect2(fx-46,cy+19,92,42),Color("#8e6b3d"))
	for i in range(5):
		draw_line(Vector2(fx-40+i*20,cy+22),Vector2(fx-40+i*20,cy+58),Color("#c5a65e"),3)
	_txt("FARM",Vector2(fx-18,cy+81),12,Color.WHITE)
	# Lumber camp
	var wx := s.x*.84
	draw_rect(Rect2(wx-26,cy+16,52,42),Color("#7b5338"))
	draw_colored_polygon(PackedVector2Array([Vector2(wx-34,cy+18),Vector2(wx,cy-5),Vector2(wx+34,cy+18)]),Color("#596e42"))
	_txt("LUMBER",Vector2(wx-26,cy+81),12,Color.WHITE)
	# Troops marching
	for i in range(mini(troops,14)):
		var tx := s.x*.12+(i%7)*17
		var ty := s.y*.69+(i/7)*22
		draw_circle(Vector2(tx,ty),7,Color("#d7dce0"))
		draw_circle(Vector2(tx,ty-2),4,Color("#e2b48b"))
		draw_line(Vector2(tx-5,ty+7),Vector2(tx+5,ty+7),Color("#6e8ab4"),4)
	# Enemy camp
	var ex := s.x*.88
	var ey := s.y*.72
	draw_circle(Vector2(ex,ey),35,Color("#75413b"))
	draw_colored_polygon(PackedVector2Array([Vector2(ex-28,ey+8),Vector2(ex,ey-30),Vector2(ex+28,ey+8)]),Color("#b85b4b"))
	draw_rect(Rect2(ex-19,ey+8,38,21),Color("#6d3e35"))
	_txt("ENEMY CAMP",Vector2(ex-47,ey+47),12,Color("#ffe0d0"))
	if flash>0: draw_circle(Vector2(ex,ey),45,Color(1,0.3,0.1,flash*.5))
	# Action panel
	var py := s.y-110
	draw_rect(Rect2(12,py,s.x-24,98),Color("#152a33"))
	draw_rect(Rect2(12,py,s.x-24,2),Color("#d5ad59"))
	_txt("KINGDOM COMMAND",Vector2(23,py+21),13,Color("#f5d98b"))
	buttons.clear()
	var names := ["Gather","Train Troops","Upgrade Castle","Barracks +","BATTLE!","Save"]
	var hints := ["Collect loot","5 soldiers","Gold + wood","Stronger army","Win rewards","Save progress"]
	for i in range(6):
		var bw := (s.x-48-40)/6.0
		var r := Rect2(24+i*(bw+8),py+29,bw,55)
		var c := Color("#2e5961")
		if i==4: c=Color("#9a443b")
		elif i==2 or i==3: c=Color("#6c5a36")
		draw_rect(r,c)
		draw_rect(r,Color("#d4b15c"),false,1.3)
		_txt(names[i],Vector2(r.position.x+6,r.position.y+21),13,Color.WHITE)
		_txt(hints[i],Vector2(r.position.x+6,r.position.y+40),10,Color("#d3e2df"))
		buttons.append({"rect":r,"id":i})
	if message_time>0:
		var mr := Rect2(s.x*.18,77,s.x*.64,35)
		draw_rect(mr,Color("#101d25",.94))
		draw_rect(mr,Color("#d5ad59"),false,1)
		_txt(message,Vector2(mr.position.x+10,mr.position.y+23),14,Color.WHITE)

func _txt(t:String,p:Vector2,sz:int,c:Color) -> void:
	draw_string(ThemeDB.fallback_font,p,t,HORIZONTAL_ALIGNMENT_LEFT,-1,sz,c)

func _input(event:InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		_click(event.position)
	elif event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT:
		_click(event.position)

func _click(p:Vector2) -> void:
	for b in buttons:
		if b.rect.has_point(p):
			match int(b.id):
				0: _gather()
				1: _train()
				2: _upgrade_castle()
				3: _upgrade_barracks()
				4: _battle()
				5: _save_game()
			queue_redraw()
			return

func _gather() -> void:
	gold+=35+castle_level*5
	wood+=30+barracks_level*2
	food+=28
	_say("Resources collected! Your kingdom grows.")
	_save_game()

func _train() -> void:
	if gold>=35 and food>=20:
		gold-=35; food-=20; troops+=5
		_say("Five soldiers joined your army!")
	else: _say("Need 35 gold and 20 food to train troops.")
	_save_game()

func _upgrade_castle() -> void:
	var cost:=100*castle_level
	if gold>=cost and wood>=cost:
		gold-=cost; wood-=cost; castle_level+=1
		_say("Castle upgraded to level "+str(castle_level)+"!")
	else: _say("Upgrade costs "+str(cost)+" gold and "+str(cost)+" wood.")
	_save_game()

func _upgrade_barracks() -> void:
	var cost:=70*barracks_level
	if gold>=cost and wood>=cost/2:
		gold-=cost; wood-=cost/2; barracks_level+=1
		_say("Barracks upgraded! Your troops fight harder.")
	else: _say("Need "+str(cost)+" gold and "+str(cost/2)+" wood.")
	_save_game()

func _battle() -> void:
	if troops<enemy_strength:
		_say("Not enough soldiers! Train more troops first.")
		return
	var power:=troops*barracks_level+castle_level*3
	var enemy_power:=enemy_strength*maxi(1,castle_level)
	if power>=enemy_power:
		var loss:=mini(troops-1,maxi(1,enemy_strength/4))
		troops-=loss; gold+=90; wood+=45; food+=35; enemy_strength+=5
		_say("VICTORY! Loot gained. Lost "+str(loss)+" soldiers.")
	else:
		troops=maxi(1,troops-3)
		_say("Defeat! Upgrade your army and try again.")
	flash=1.0
	_save_game()

func _say(t:String) -> void:
	message=t
	message_time=3.5

func _save_game() -> void:
	var d={"gold":gold,"wood":wood,"food":food,"troops":troops,"castle_level":castle_level,"barracks_level":barracks_level,"enemy_strength":enemy_strength}
	var f:=FileAccess.open(SAVE_PATH,FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(d))
	_say("Kingdom progress saved!")

func _load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH): return
	var f:=FileAccess.open(SAVE_PATH,FileAccess.READ)
	if not f: return
	var d=JSON.parse_string(f.get_as_text())
	if typeof(d)==TYPE_DICTIONARY:
		gold=int(d.get("gold",gold)); wood=int(d.get("wood",wood)); food=int(d.get("food",food))
		troops=int(d.get("troops",troops)); castle_level=int(d.get("castle_level",castle_level))
		barracks_level=int(d.get("barracks_level",barracks_level)); enemy_strength=int(d.get("enemy_strength",enemy_strength))
