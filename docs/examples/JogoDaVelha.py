tabuleiro = [
    [' ', ' ', ' '],
    [' ', ' ', ' '],
    [' ', ' ', ' ']
]

jogador_atual = 'X'


def exibir_tabuleiro():
    print("     |     |     ")
    print(f"  {tabuleiro[0][0]}  |  {tabuleiro[0][1]}  |  {tabuleiro[0][2]}  ")
    print("_____|_____|_____")
    print("     |     |     ")
    print(f"  {tabuleiro[1][0]}  |  {tabuleiro[1][1]}  |  {tabuleiro[1][2]}  ")
    print("_____|_____|_____")
    print("     |     |     ")
    print(f"  {tabuleiro[2][0]}  |  {tabuleiro[2][1]}  |  {tabuleiro[2][2]}  ")
    print("     |     |     ")
    print()


def verificar_vitoria(jogador):
    for i in range(3):
        if tabuleiro[i][0] == jogador and tabuleiro[i][1] == jogador and tabuleiro[i][2] == jogador:
            return True

    for i in range(3):
        if tabuleiro[0][i] == jogador and tabuleiro[1][i] == jogador and tabuleiro[2][i] == jogador:
            return True

    if tabuleiro[0][0] == jogador and tabuleiro[1][1] == jogador and tabuleiro[2][2] == jogador:
        return True

    if tabuleiro[0][2] == jogador and tabuleiro[1][1] == jogador and tabuleiro[2][0] == jogador:
        return True

    return False


def reiniciar_jogo():
    global tabuleiro, jogador_atual
    tabuleiro = [
        [' ', ' ', ' '],
        [' ', ' ', ' '],
        [' ', ' ', ' ']
    ]
    jogador_atual = 'X'


def main():
    global jogador_atual

    print("=============================")
    print("   JOGO DA VELHA em Python")
    print("=============================")
    print("Jogador 1: X  |  Jogador 2: O")
    print("Use números de 1 a 9 para jogar:")
    print(" 1 | 2 | 3 ")
    print("-----------")
    print(" 4 | 5 | 6 ")
    print("-----------")
    print(" 7 | 8 | 9 ")
    print("=============================\n")

    jogadas = 0

    while True:
        exibir_tabuleiro()
        print(f"Jogador {jogador_atual}, escolha uma posição (1-9): ", end='')

        try:
            posicao = int(input().strip())
        except ValueError:
            print("Entrada inválida! Digite um número de 1 a 9.\n")
            continue

        if posicao < 1 or posicao > 9:
            print("Posição inválida! Escolha entre 1 e 9.\n")
            continue

        linha = (posicao - 1) // 3
        coluna = (posicao - 1) % 3

        if tabuleiro[linha][coluna] != ' ':
            print("Posição já ocupada! Tente outra.\n")
            continue

        tabuleiro[linha][coluna] = jogador_atual
        jogadas += 1

        if verificar_vitoria(jogador_atual):
            exibir_tabuleiro()
            print(f"Parabéns! Jogador {jogador_atual} venceu! 🎉\n")
            break

        if jogadas == 9:
            exibir_tabuleiro()
            print("Empate! O jogo terminou sem vencedor.")
            break

        jogador_atual = 'O' if jogador_atual == 'X' else 'X'

    print("\nDeseja jogar novamente? (s/n): ")
    resposta = input().strip().lower()
    if resposta == 's':
        reiniciar_jogo()
        main()
    else:
        print("Obrigado por jogar! Até a próxima!")


if __name__ == '__main__':
    main()
