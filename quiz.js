// Leticia Rodriguez y María Estraviz.

var HTTP = require('http');
var URL  = require('url');
var QS   = require('querystring');
var FS   = require('fs');
var MIME = require('mime');

HTTP.createServer(function(request, response) {

  var MODEL = {

    find: function (question, action) {
      FS.readFile('bbdd.txt', 'utf-8', function(err, bbdd) {
        action(err, bbdd.match(new RegExp('^'+question+': .*$','m')));
      });
    },

    all_questions: function (action) {	//busca lista de preguntas en bbdd.txt
      FS.readFile('bbdd.txt', 'utf-8', function(err, bbdd) {
        action(err, bbdd.replace(/^(.*): .*$/mg, '<option>$1</option>'));
      });
    },

    create: function (question, action) {
      FS.appendFile('bbdd.txt', question + '\n', 'utf-8', function(err){
        action(err);
      });
    },

    delete: function (question, action) {
      FS.readFile('bbdd.txt','utf-8', function(err, bbdd) {
        if (!err) {
          bbdd = bbdd.replace(new RegExp(question + ':.*\n', 'g'), '');
          FS.writeFile('bbdd.txt', bbdd, 'utf-8', function (err) {
            action(err);
          });
        } else { action(err); };
      });
    },

    edit: function(lastquestion, question, action) {
      FS.readFile('bbdd.txt','utf-8', function(err, bbdd) {
        if (!err) {
          bbdd = bbdd.replace(new RegExp(lastquestion + ':.*\n', 'g'),question + "\n");
          FS.writeFile('bbdd.txt', bbdd, 'utf-8', function (err) {
            action(err);
          });
        } else { action(err); };
      });
    }

  }


 var VIEW = {
    render: function (file, r1, question) {	
      FS.readFile('app.html', 'utf-8', function(err, app) {	//leer marco:app.html
        if (!err) {
          FS.readFile(file, 'utf-8', function(err, view) {	//leer vista
            if (!err) {
              var data = app.replace(/<%view%>/, view);	//integramos el marco y la vista
              data = data.replace(/<%r1%>/g, r1);// integramos el parámetro <%r1%>
              data = data.replace(/<%question%>/, question)
			  //integramos el parámetro  <%question%>
              response.writeHead(200, {
                'Content-Type': 'text/html', 
                'Content-Length': data.length 
              }); 
              response.end(data);
            } else { VIEW.error(500, "Server operation Error_r1"); };
          });
        } else { VIEW.error(500, "Server operation Error_r2"); };
      });
    },

    error: function(code,msg) { response.writeHead(code); response.end(msg);},

    file: function(file) {	//envia fichero con su mime-type
      FS.readFile(file, function(err, data) {
        if (!err) {
          response.writeHead(200, { 
            'Content-Type': MIME.lookup(file), 
            'Content-Length': data.length 
          }); 
          response.end(data);
        } else { VIEW.error (500, file + " not found"); };
      });
    }
  }


  var CONTROLLER = {
    index: function () {	//inserta la lista de preguntas en select de vista 
      MODEL.all_questions (function(err, all_questions) {
        if (!err) VIEW.render('index.html', all_questions, "");
        else      VIEW.error(500, "Server bbdd Error_a");
      });
    },

    show: function () { 
      MODEL.find(question, function(err, resp) {
        //if (!err) VIEW.render('show.html',(resp||["Sin respuesta"])[0],"");
		if (!err) VIEW.render('show.html',resp,"");
        else      VIEW.error(500, "Server bbdd Error_b");
      });
    },

	
    file: function() { VIEW.file(url.pathname.slice(1)); },	//invoca vista

    new: function () { VIEW.render ('new.html', "", ""); },

    create: function () {
      MODEL.create(question, function(err) {
        if (!err) CONTROLLER.index();  // redirección a 'GET quiz/index'
        else      VIEW.error(500, "Server bbdd Error_c");
      });
    },

    remove: function() {
      MODEL.all_questions (function(err, all_questions) {
        if (!err) VIEW.render('remove.html', all_questions, "");
        else      VIEW.error(500, "Server bbdd Error_d");
      });
    },

    delete: function () {
      MODEL.delete (question, function(err) {
        if (!err) CONTROLLER.index();  // redirección a 'GET quiz/index'
        else      VIEW.error(500, "Server bbdd Error_e");
      });
    },

    edit: function () {
      lastquestion = question;
      MODEL.find(question, function(err, answer){
        if (!err) VIEW.render('edit.html', "", (answer||["Sin respuesta"])[0]);
        // if(!err) VIEW.render('edit.html', all_questions);
        else     VIEW.error(500, "Server bbdd Error_d");
      });
    },

    update: function () {
      MODEL.edit(lastquestion, question, function(err){
        if(!err) CONTROLLER.index();  // redirección a 'GET quiz/index'
        else     VIEW.error(500, "Server bbdd Error_d");
      });
    }
  }


  var url = URL.parse(request.url, true);	//parsea query de URL (show)
  var post_data = "";
  request.on('data', function (chunk) { post_data += chunk; });
  request.on('end', function() {	//body de POST llega con eventos data y end

    post_data = QS.parse(post_data);	//parsea query en body-POST (create)

    // "question" variable global:visible en controlador
    question  = (post_data.preg || url.query.preg);	// Extrae  pregunta de query de url o de body
    // answer = (post_data.resp || url.query.resp);
    var route = (post_data._method || request.method) + ' ' + url.pathname;	//creamos ruta

    console.log('route: '+ route)

    switch (route) {	// Analizamos la ruta e invocamos al controlador
      
      case 'GET /quiz/index'     : CONTROLLER.index()   ; break;
      case 'GET /quiz/show'      : CONTROLLER.show()    ; break;
      case 'GET /quiz/new'       : CONTROLLER.new()     ; break;
      case 'POST /quiz/create'   : CONTROLLER.create()  ; break;	//crear consultas: POST
      case 'GET /quiz/remove'    : CONTROLLER.remove()  ; break;
      case 'DELETE /quiz/delete' : CONTROLLER.delete()  ; break;
      case 'GET /quiz/edit'      : CONTROLLER.edit()    ; break;
	  case 'PUT /quiz/update'      : CONTROLLER.update()    ; break;
      default: {	//sirve fichero si no es ningún path anterior
        if (request.method == 'GET') CONTROLLER.file() ;
        else VIEW.error(400, "Unsupported request");
      }
    }
  });
}).listen(3000);