/**
 * Created by ZHUANGYI on 2018/3/8.
 */
var followList = {

    //取消关注
    //点击编辑按钮任意切换
    showCheckBox:function(){

        var allMessageList=document.getElementsByClassName('followcheck');

        var allcheckBox=document.getElementsByClassName('follow_box');

        if(this.innerHTML.indexOf('编辑')>-1){

            for(var i=0;i<allcheckBox.length;i++){

                allMessageList[i].className="followcheck radio_show";

            }

            document.getElementsByClassName('tab_content')[0].style.transform="translate3d(0,0,0)";

            this.innerHTML="取消";


        }else if(this.innerHTML.indexOf('取消')>-1) {



            this.innerHTML="编辑";

            for(var i=0;i<allcheckBox.length;i++){

                allMessageList[i].className="followcheck";

            }

            var allCheckBox=document.getElementsByClassName('aui-radio');

            for(var j=0;j<allCheckBox.length;j++){

                allCheckBox[j].checked=false
            }

            document.getElementsByClassName('tab_content')[0].style.transform="translate3d(0,100%,0)";

        }
    },

    //收起取消关注tab
    retractTab:function () {

    var allMessageList=document.getElementsByClassName('followcheck');

    var allcheckBox=document.getElementsByClassName('follow_box');

    if(document.getElementById('followGoods').innerHTML.indexOf('取消')>-1){

        for(var i=0;i<allcheckBox.length;i++){

            allMessageList[i].className="followcheck";

        }


        document.getElementsByClassName('tab_content')[0].style.transform="translate3d(0,100%,0)";

        document.getElementById('followGoods').innerHTML = '编辑';
    }

}


}