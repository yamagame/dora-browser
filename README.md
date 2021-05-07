# dora-browser

遠隔操作できるブラウザです。Electron を使用しています。

## 準備

```
$ cd ~
$ git clone https://github.com/yamagame/dora-browser
$ cd dora-browser
$ yarn install
```

## 実行

```
$ cd ~
$ cd dora-browser
$ yarn start
```

## 自動起動

ラズベリーパイで自動起動するには、~/.config/lxsession/LXDE-pi/autostart に下記の１行を追加します。

```
@/home/pi/dora-browser/start.sh
```

※dora-browser のディレクトリの位置が異なる場合は変更してください。

## 使い方

実行すると、内部で Web サーバーが起動します。POST リクエストを使ってコマンドを送信するとコントロールできます。

ウインドウには名前をつけて操作します。名前を使うことで複数のウインドウを操作することができます。

以下の例では、localhost で操作することを想定して説明しています。

### open コマンド

Window を開くメッセージ

```
$ curl -X POST http://localhost:5000/open/[ウインドウ名]
```

例：

```
$ curl -X POST http://localhost:5000/open/main
```

以下のようにすると開くページの URL を指定できます。信用のないウェブページは開かないでください。

```
$ curl -X POST -d '{"url":"https://www.apple.com/"}' --header "content-type:application/json" http://localhost:5000/open/main
```

### reload コマンド

ページをリロードします。

```
$ curl -X POST http://localhost:5000/reload/[ウインドウ名]
```

### close コマンド

指定したウインドウを閉じます。

```
$ curl -X POST http://localhost:5000/close/[ウインドウ名]
```

例：

```
$ curl -X POST http://localhost:5000/close/main
```

### show コマンド

指定したウインドウを表示して手前に持ってきます。

```
$ curl -X POST http://localhost:5000/show/[ウインドウ名]
```

例：

```
$ curl -X POST http://localhost:5000/show/main
```

### hide コマンド

指定したウインドウを非表示して手前に持ってきます。

```
$ curl -X POST http://localhost:5000/hide/[ウインドウ名]
```

例：

```
$ curl -X POST http://localhost:5000/hide/main
```

### print コマンド

指定したウインドウを印刷します。

```
$ curl -X POST http://localhost:5000/print/[ウインドウ名]
```

### closeAll コマンド

全てのウインドウを閉じます

```
$ curl -X POST http://localhost:5000/closeAll
```

## セキュリティについて

Electron を使用した遠隔操作できるブラウザです。使用には注意してください。
