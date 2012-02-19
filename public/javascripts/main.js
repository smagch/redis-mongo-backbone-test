(function($, _, Backbone){
  
  
  
  var AppView = Backbone.View.extend({
    el: '#wrapper',
    initialize: function() {
      this.$input = $('#input');
    },
    events: {
      'keydown #input': 'sendText'
    },
    sendText: function(e) {
      if(e.keyCode === 13) {
        var val = this.$input.val();
        // send text to server
        
        
        this.$input.val('');
      }
    }
  });
  
  var app = new AppView();
})(jQuery, _, Backbone);