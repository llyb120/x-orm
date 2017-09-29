import { OrderGoods } from './../example/order_goods';
import { Member } from './../example/member';
// import "mocha";
import "should";
import { X } from "../x";
import { MysqlConfig } from "../index";
import { Order } from '../example/order';
import { GoodsClass } from '../example/goods_class';

//import
OrderGoods
var config : MysqlConfig = {
    "name": "default",
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "username": "root",
    "password": "123",
    "database": "yoehi",
    // "autoSchemaSync": false,`
    // "entities": [
    // ],
    // "subscribers": [
    // 
    // ],
    // "migrations": [
    // 
    // ],
    "tablesPrefix": "ra_",
    "debug": false
};



describe('start', () => {
    it("should start success", async() => {
        try{
            await X.startORM(config);
        }
        catch(e){
            should.not.exist(config);
        }
    });

    var member_id;
    it("add user", (done) => {
        var member = new Member;
        member.member_name = 'bin';
        X.save(member).then(() => {
            should.exists(member.member_id);
            member.member_id.should.above(0);
            member_id = member.member_id;
            done();
        });

    });

    it("count user",async() => {
        const num = await X.of(Member).count({
            where : {
                member_id : ['>=',0]
            }
        });
        should.exist(num);
        num.should.above(0);
    });

    var members: any = null;
    it("search user", (done) => {
        X.of(Member).find({
            where: {
                member_name: "bin"
            }
        }).then(_members => {
            _members.length.should.above(0);
            members = _members
            done();
        });
    });

    it("delete user", (done) => {
        should.exist(members);
        X.delete(members).then(flag => {
            flag.should.equal(true);

            X.of(Member).find({
                where: {
                    member_name: 'bin'
                }
            }).then(ms => {
                ms.length.should.eql(0);
                done()
            });
        });
    });

    /**
     * 测试附加字段
     */
    it("test addon", (done) => {
        X.of(Order).findOne({
            order: {
                order_id: "desc"
            },
            addon: {
                order_goods: 1
            }
        }).then(order => {
            should.exist(order);
            if (order) {
                should.exist(order.order_goods);
                order.order_goods.length.should.above(0);
            }
            done();
            // order
        }).catch(e => {
            should.not.exist(e);
        });
    })


    /**
     * 测试树模式
     */
    it("test tree class", async () => {
        try {
            let gc = await X.of(GoodsClass).findOne();
            should.exist(gc);
            if (gc) {
                await X.makeAddon(gc, 'children');
                should.exist(gc.children);
                gc.children.length.should.above(0);
                await X.makeAddon(gc, 'parent')
                should.exist(gc.parent);
            }
        }
        catch (e) {
            should.not.exist(e);
        }

    });

}); 