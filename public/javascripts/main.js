(function($, _, Backbone){
  
  // main author can block sync.
  // can be able to see previous saved state
  // and current state.
  //console.log('id : ' + id);
  
  var ArticleModel = Backbone.Model.extend({
    
  });
  
  var ArticleCollection = Backbone.Collection.extend({
    model: ArticleModel
    // url: function() {
    //   return '/post/' + id;
    // }
  });
  
  var AppView = Backbone.View.extend({
    el: '#wrapper',
    initialize: function() {
      //this.$input = $('#input');
      //this.collection = new ArticleCollection();
      $('#get-text').on('click', function(e) {
        console.log('click');
        $.ajax({
          type: 'GET',
          dataType: 'json',
          contentType: 'application/json',
          url: '/dropbox/gettext'
        })
        .fail(function(e) {
          console.log('error');
          console.dir( e );
        })
        .done(function(obj) {
          console.log('done');
          console.dir( obj );
        });
      });
    },
    events: {
      //'keydown #input': 'sendText'
    }
    // sendText: function(e) {
    //   if(e.keyCode === 13) {
    //     var val = this.$input.val();
    //     var model = {
    //       text: 'this is test model'
    //     };
    //     
    //     $.ajax({
    //       type: 'POST',
    //       dataType: 'json',
    //       contentType: 'application/json',
    //       url: '/dropbox'
    //       data: JSON.stringify(model)
    //     })
    //     .done(function(res) {
    //       console.log('done');
    //       console.log('res : ' + res);
    //     })
    //     .fail(function(e) {
    //       console.log('fail');
    //       console.dir( e );
    //     });
    //     this.$input.val('');
    //   }
    //}
  });
  
  var app = new AppView();
})(jQuery, _, Backbone);