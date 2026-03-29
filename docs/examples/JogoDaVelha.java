import java.util.Scanner;

public class JogoDaVelha {

    static char[][] tabuleiro = {
        {' ', ' ', ' '},
        {' ', ' ', ' '},
        {' ', ' ', ' '}
    };

    static char jogadorAtual = 'X';

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println("=============================");
        System.out.println("   JOGO DA VELHA em Java");
        System.out.println("=============================");
        System.out.println("Jogador 1: X  |  Jogador 2: O");
        System.out.println("Use números de 1 a 9 para jogar:");
        System.out.println(" 1 | 2 | 3 ");
        System.out.println("-----------");
        System.out.println(" 4 | 5 | 6 ");
        System.out.println("-----------");
        System.out.println(" 7 | 8 | 9 ");
        System.out.println("=============================\n");

        int jogadas = 0;

        while (true) {
            exibirTabuleiro();
            System.out.printf("Jogador %c, escolha uma posição (1-9): ", jogadorAtual);

            int posicao;
            try {
                posicao = Integer.parseInt(scanner.nextLine().trim());
            } catch (NumberFormatException e) {
                System.out.println("Entrada inválida! Digite um número de 1 a 9.\n");
                continue;
            }

            if (posicao < 1 || posicao > 9) {
                System.out.println("Posição inválida! Escolha entre 1 e 9.\n");
                continue;
            }

            int linha = (posicao - 1) / 3;
            int coluna = (posicao - 1) % 3;

            if (tabuleiro[linha][coluna] != ' ') {
                System.out.println("Posição já ocupada! Tente outra.\n");
                continue;
            }

            tabuleiro[linha][coluna] = jogadorAtual;
            jogadas++;

            if (verificarVitoria(jogadorAtual)) {
                exibirTabuleiro();
                System.out.printf("Parabéns! Jogador %c venceu! 🎉%n%n", jogadorAtual);
                break;
            }

            if (jogadas == 9) {
                exibirTabuleiro();
                System.out.println("Empate! O jogo terminou sem vencedor.");
                break;
            }

            jogadorAtual = (jogadorAtual == 'X') ? 'O' : 'X';
        }

        System.out.println("\nDeseja jogar novamente? (s/n): ");
        String resposta = scanner.nextLine().trim().toLowerCase();
        if (resposta.equals("s")) {
            reiniciarJogo();
            main(args);
        } else {
            System.out.println("Obrigado por jogar! Até a próxima!");
        }

        scanner.close();
    }

    static void exibirTabuleiro() {
        System.out.println("     |     |     ");
        System.out.printf("  %c  |  %c  |  %c  %n", tabuleiro[0][0], tabuleiro[0][1], tabuleiro[0][2]);
        System.out.println("_____|_____|_____");
        System.out.println("     |     |     ");
        System.out.printf("  %c  |  %c  |  %c  %n", tabuleiro[1][0], tabuleiro[1][1], tabuleiro[1][2]);
        System.out.println("_____|_____|_____");
        System.out.println("     |     |     ");
        System.out.printf("  %c  |  %c  |  %c  %n", tabuleiro[2][0], tabuleiro[2][1], tabuleiro[2][2]);
        System.out.println("     |     |     ");
        System.out.println();
    }

    static boolean verificarVitoria(char jogador) {
        // Verifica linhas
        for (int i = 0; i < 3; i++) {
            if (tabuleiro[i][0] == jogador && tabuleiro[i][1] == jogador && tabuleiro[i][2] == jogador) {
                return true;
            }
        }

        // Verifica colunas
        for (int i = 0; i < 3; i++) {
            if (tabuleiro[0][i] == jogador && tabuleiro[1][i] == jogador && tabuleiro[2][i] == jogador) {
                return true;
            }
        }

        // Verifica diagonal principal
        if (tabuleiro[0][0] == jogador && tabuleiro[1][1] == jogador && tabuleiro[2][2] == jogador) {
            return true;
        }

        // Verifica diagonal secundária
        if (tabuleiro[0][2] == jogador && tabuleiro[1][1] == jogador && tabuleiro[2][0] == jogador) {
            return true;
        }

        return false;
    }

    static void reiniciarJogo() {
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                tabuleiro[i][j] = ' ';
            }
        }
        jogadorAtual = 'X';
    }
}
